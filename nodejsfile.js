let express = require('express');
let consolidate = require('consolidate');
let MongoClient = require('mongodb').MongoClient;
let Server = require('mongodb').Server;
let session = require('express-session');
let bodyParser = require("body-parser");
var https = require('https');
var fs = require('fs');
var bcrypt = require('bcrypt');
var _ = require('underscore');
const saltRounds = 10;

let app = express();
app.engine('html', consolidate.hogan);
app.set('views','static');
app.use(express.static('static'));

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret:'safestreets123'}));


function date(){
  let date = new Date();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  let d = ("Today's Date : " + date.getDate() + " " + months[Number(date.getMonth())] + " " + date.getFullYear());
  return d;
}

function getFullDate(){
  let date = new Date();
  let d = date.getDate() + "/" + (Number(date.getMonth())+1).toString() +"/" + date.getFullYear();
  return d;
}

MongoClient.connect('mongodb://localhost:27017', (err, db) => {
  dbo = db.db("saferstreets");
  dbo.collection('incidents').createIndex({"description":"text"});
  if (err) throw err;
  app.get('/homepage', (req, res) => {
    dbo.collection('incidents').find({}).toArray((err, doc) => {
      if (err) throw err;
      if(req.session.username!=null){
        let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
        res.render('homepage_loggedOn.html', newDoc)
      }
      else{
        let newDoc = {"incident_list" : doc, "date_today" : date()};
        res.render('homepage.html', newDoc);
      }
    });
  });
  
  app.get('/', (req, res) => {
    res.redirect("/homepage")
  })

  app.get('/searchincident', (req, res) => {
    let searchWords = req.query.search_words;
    dbo.collection('incidents').find({$text:{$search:searchWords, $language:"en"}}).toArray((err, doc) => {
      if (err) throw err;
	  if (doc.length == 0){
		if (req.session.username != null){
			res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
		} else {
		    res.render('homepage.html',{nomatchErrorMessage : "No match found"});
		}
	  }
      else if(req.session.username!=null){
        let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
        res.render('homepage_loggedOn.html', newDoc);
      }
      else{
        let newDoc = {"incident_list" : doc, "date_today" : date()};
        res.render('homepage.html', newDoc);
      }
    });
  });

  app.post('/register', (req,res) => {
    dbo.collection('saferstreetsUsers').findOne({"username": req.body.username}, (err, result)=>{
      if(err) throw err;
      console.log(result);
      if (result!=null){
        res.render('idpage.html', {registerErrorMessage : "Username already taken"});
      }
      else {
        let username = req.body.username;
        let password = req.body.pwd;
        bcrypt.hash(password, saltRounds, function(err, hash){
          var newUser = {"username" : username, "password" : hash};
          dbo.collection('saferstreetsUsers').insertOne(newUser, function(err,result){
          if(err) throw err;
            console.log('User added successfully');
          });
          req.session.username = username;
          res.render("incident.html",{username : req.session.username});
        });
      }
    });
  });
    
  app.get('/reportIncident', (req,res)=> {
    if(req.session.username){
      res.render("incident.html", {username : req.session.username});
    }
    else{
      res.render("idpage.html" , {someErrorMessage:"Please log in or create an account first"});
    }
});

  app.get('/advanced_search', (req,res) => {
    res.render("advancedsearch.html");
  });
  
  app.get('/login', (req,res) => {
    res.render("idpage.html");
  });

  app.post('/addIncident', (req,res) => {
    let incidentDescription = req.body.incident_description;
    let incidentLocation = req.body.incident_address;
    let reportedBy = req.session.username;
    let date = getFullDate();
    var newIncident = {"address" : incidentLocation, "description" : incidentDescription, "user" : reportedBy, "date" : date}
    dbo.collection('incidents').insertOne(newIncident, function(err,res){
      if(err) throw err;
      console.log("Incident added successfully");    
    });
    res.redirect("/homepage");
  });

  app.post('/loginPage', function(req,res,next){
    dbo.collection('saferstreetsUsers').findOne({"username" : req.body.username}, function(err, result){
      if (err) throw err;
      if (result==null){
        res.render('idpage.html', {loginErrorMessage : "Wrong username or password"});
      }
      else{
        bcrypt.compare(req.body.pwd, result.password, function(err, result){
          if(err) throw err;
          if(result){
            req.session.username = req.body.username;
            res.render('incident.html', {username : req.session.username});
          }
          else{
            res.render('idpage.html', {loginErrorMessage : "Wrong username or password"});
          }
        });
      }
    });
  });

  app.get('/logout', function(req,res,next){
    req.session.username = null;
    res.redirect("/homepage");
  });
  
  app.get('/advsearch', (req, res) => {
	let descr = req.query.incident_descr;
	let loc = req.query.incident_location;
	let usern = req.query.reportedby_user;
	let dateof = req.query.incident_date;
	if (descr == "" && loc == "" && usern == "" && dateof == ""){
		res.render('advancedsearch.html', {searchErrorMessage : "Fill at least one search field"});
	} else {
		if (descr != "" && loc != "" && usern != "" && dateof != ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $adress:loc, $user:usern, $date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		} else if (descr != "" && loc != "" && usern != "" && dateof == ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $adress:loc, $user:usern}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr != "" && loc != "" && usern == "" && dateof == ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $adress:loc}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr != "" && loc == "" && usern == "" && dateof == ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $adress:loc}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr != "" && loc == "" && usern != "" && dateof != ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $user:usern, $date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr != "" && loc == "" && usern != "" && dateof == ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $user:usern}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr != "" && loc == "" && usern == "" && dateof != ""){
			dbo.collection('incidents').find({$text:{$search:descr, $language:"en"}, $date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc != "" && usern != "" && dateof != ""){
			dbo.collection('incidents').find({$address:loc, $user:usern, $date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc != "" && usern != "" && dateof == ""){
			dbo.collection('incidents').find({$address:loc, $user:usern}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc != "" && usern == "" && dateof != ""){
			dbo.collection('incidents').find({$address:loc, $date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc != "" && usern == "" && dateof == ""){
			dbo.collection('incidents').find({$address:loc}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc == "" && usern != "" && dateof != ""){
			dbo.collection('incidents').find({$user:usern, $date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc == "" && usern != "" && dateof == ""){
			dbo.collection('incidents').find({$user:usern}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}else if (descr == "" && loc == "" && usern == "" && dateof != ""){
			dbo.collection('incidents').find({$date:dateof}).toArray((err, doc) => {
				if (err) throw err;
				if (doc.length == 0){
					if (req.session.username != null){
						res.render('homepage_loggedOn.html',{nomatchErrorMessage : "No match found"});
					} else {
						res.render('homepage.html',{nomatchErrorMessage : "No match found"});
					}
				}else if(req.session.username!=null){
					let newDoc = {"incident_list" : doc, "date_today" : date(), username:req.session.username};
					res.render('homepage_loggedOn.html', newDoc);
				}else{
					let newDoc = {"incident_list" : doc, "date_today" : date()};
					res.render('homepage.html', newDoc);
				}
			});
		}
	}
  });

 // app.get('*', (req, res) => {
   // res.status(404).sent("Page Not Found");
 // });
  https.createServer({key: fs.readFileSync('./key.pem'), cert: fs.readFileSync('./cert.pem'),
  passphrase: 'ingi'}, app).listen(8080);
  console.log("Exress server started on port 8080");
});


