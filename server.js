var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;

var USERS_COLLECTION = "users";

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI, function(err, database) {

	if (err) {
		console.log(err);
		process.exit(1);
	}

	// Save database object from the callback for reuse.
	db = database;
	console.log("Database connection ready");

	// Initialize the app.
	var server = app.listen(process.env.PORT || 8080, function () {
		var port = server.address().port;
		console.log("App now running on port", port);
	});

});

// API Routes below *********************************

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}

/*  "/login"
 *    POST: Login the user
 */


app.post("/login", function(req, res) {

	console.log(req);
	// db.collection(USERS_COLLECTION).find({}).toArray(function(err, docs) {

	//     if (err) {
	//     	handleError(res, err.message, "Failed to get contacts.");
	//     } else {
	//     	res.status(200).json(docs);
	//     }

	// });

});


/*  "/createuser"
 *    POST: Create the user
 */


app.post("/createuser", function(req, res) {

	var newUser = req.body;
	newUser.createDate = new Date();

	if (!(req.body.email || req.body.password)) {
		handleError(res, "Invalid user input", "Must provide a username and password.", 400);
	}

	db.collection(USERS_COLLECTION).insertOne(newUser, function(err, doc) {

		if (err) {
			handleError(res, err.message, "Failed to create new user.");
		} else {
			res.status(201).json(doc.ops[0]);
		}

	});

});
