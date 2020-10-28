let express = require('express');
let consolidate = require('consolidate');
let MongoClient = require('mongodb').MongoClient;
let Server = require('mongodb').Server;

let app = express()
app.engine('html', consolidate.hogan)
app.set('views','static');
//app.set('views engine', 'html'); // vient de mongodb-express.js
app.use(express.static('static')); // à quoi sert cette lisgne ?


function date(){
  let date = new Date();
  let d = ("Today's Date : " + date.getDate() + "/" + (Number(date.getMonth())+1).toString() + "/" + date.getFullYear());
  return d;
}

MongoClient.connect('mongodb://localhost:27017', (err, db) => {
  dbo = db.db("saferstreets");
  if (err) throw err;

  app.get('/', (req, res) => {
    dbo.collection('incidents').findOne((err, doc) => {
      if (err) throw err;
      res.render('homepage.html', doc);
    });
  });

  app.get('/login', function(req,res,next){
    if (req.query.pwd == "123pass"){
      res.render('homepage_loggedOn.html', {username: req.query.username});
    }
    else {
      res.render('idpage.html');
    }
  });

 // app.get('*', (req, res) => {
   // res.status(404).sent("Page Not Found");
 // });
  app.listen(8080);
  console.log("Exress server started on port 8080");
});


