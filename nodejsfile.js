let express = require('express');
let consolidate = require('consolidate');
let MongoClient = require('mongodb').MongoClient;
let Server = require('mongodb').Server;
let session = require('express-session');
let bodyParser = require("body-parser");
var https = require('https');
var fs = require('fs');

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
  dbo.collection('incidents').createIndex({"description":"text","address":"text","user":"text","date":"text"});
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
  
  app.get('/searchincident', (req, res) => {
	let searchWords = req.body.search_words;
	dbo.collection('incidents').find({$text:{$search:searchWords}}).toArray((err, doc) => {
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
        var newUser = {"username" : username, "password" : password};
        dbo.collection('saferstreetsUsers').insertOne(newUser, function(err,result){
          if(err) throw err;
          console.log('User added successfuly');
        });
        req.session.username = username;
        res.render("incident.html",{username : req.session.username});
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
      console.log("Incident added successfuly");    
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
        if(result.password==req.body.pwd){
          req.session.username = req.body.username;
          res.render('incident.html', {username : req.session.username});
        }
        else{
          res.render('idpage.html', {loginErrorMessage : "Wrong username or password"});
        }
      }
    });
  });

  app.get('/logout', function(req,res,next){
    req.session.username = null;
    res.redirect("/homepage");
  });

 // app.get('*', (req, res) => {
   // res.status(404).sent("Page Not Found");
 // });
  https.createServer({key: fs.readFileSync('./key.pem'), cert: fs.readFileSync('./cert.pem'),
  passphrase: 'ingi'}, app).listen(8080);
  console.log("Exress server started on port 8080");
});


