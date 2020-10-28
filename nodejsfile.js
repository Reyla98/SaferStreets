let express = require('express');
let consolidate = require('consolidate');
let MongoClient = require('mongodb').MongoClient;
let Server = require('mongodb').Server;
let session = require('express-session');

let app = express();
app.engine('html', consolidate.hogan);
app.set('views','static');
app.use(express.static('static'));
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

  app.get('/register', (req,res) => {
    dbo.collection('saferstreetsUsers').findOne({"username": req.query.username}, (err, result)=>{
      if(err) throw err;
      console.log(result);
      if (result!=null){
        res.redirect('idpage.html');
      }
      else {
        let username = req.query.username;
        let password = req.query.pwd;
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
    if(req.session.username!=null){
      res.render("incident.html", {username : req.session.username});
    }
    else{
      res.redirect("/loginPage");
    }
});

  app.get('/loginPage', (req,res) => {
    res.render("idpage.html");
  });

  app.get('/addIncident', (req,res) => {
    let incidentDescription = req.query.incident_description;
    let incidentLocation = req.query.incident_address;
    let reportedBy = req.session.username;
    let date = getFullDate();
    var newIncident = {"address" : incidentLocation, "description" : incidentDescription, "user" : reportedBy, "date" : date}
    dbo.collection('incidents').insertOne(newIncident, function(err,res){
      if(err) throw err;
      console.log("Incident added successfuly");    
    });
    res.redirect("/homepage");
  });

  app.get('/login', function(req,res,next){
    dbo.collection('saferstreetsUsers').findOne({"username" : req.query.username}, function(err, result){
      if (err) throw err;
      if (result==null){
        res.redirect('idpage.html');
      }
      else{
        if(result.password==req.query.pwd){
          req.session.username = req.query.username;
          res.render('incident.html', {username : req.query.username});
        }
        else{
          res.redirect('idpage.html');
        }
      }
    });
  });

 // app.get('*', (req, res) => {
   // res.status(404).sent("Page Not Found");
 // });
  app.listen(8080);
  console.log("Exress server started on port 8080");
});


