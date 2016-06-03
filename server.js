var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var morgan = require('morgan');
var mongoose = require('mongoose');
var passport = require('passport');
var config = require('./config/database'); // get db config file
var User = require('./app/models/user'); // get the mongoose model
var Grocery = require('./app/models/grocery'); // get the mongoose model
var port = process.env.PORT || 8080;
var jwt = require('jwt-simple');

// Initialise the app
var app = express();

// get our request parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// log to console
app.use(morgan('dev'));

// Use the passport package in our application
app.use(passport.initialize());

// demo Route (GET http://localhost:8080)
app.get('/', function(req, res) {
	res.send('Hello! The API is at http://api.pickatask.com:' + port + '/api');
});

// Start the server
app.listen(port);
console.log('There will be dragons: http://api.pickatask.com:' + port);

// connect to database
mongoose.connect(config.database);

// pass passport for configuration
require('./config/passport')(passport);

// bundle our routes
var apiRoutes = express.Router();

// create a new user account (POST /api/user/signup)
apiRoutes.post('/user/signup', function(req, res) {

	if(!req.body.email || !req.body.password) {

		res.json({success: false, msg: 'Please pass email and password.'});

	} else {

		var newUser = new User({
			email: req.body.email,
			password: req.body.password
		});

		// save the user
		newUser.save(function(err) {

			if(err)
				return res.json({success: false, msg: 'You are already registered. Please login!'});

			res.json({success: true, msg: 'Successful created new user.'});
		});
	}

});

// route to authenticate a user (POST /api/user/authenticate)
apiRoutes.post('/user/authenticate', function(req, res) {

	User.findOne({email: req.body.email}, function(err, user) {

		if(err)
			throw err;

		if(!user) {

			res.send({success: false, msg: 'Authentication failed. User not found.'});

		} else {

			// check if password matches
			user.comparePassword(req.body.password, function(err, isMatch) {

				if(isMatch && !err) {
					// if user is found and password is right create a token
					var token = jwt.encode(user, config.secret);
					// return the information including token as JSON
					res.json({success: true, token: 'JWT ' + token});
				} else {
					res.send({success: false, msg: 'Authentication failed. Wrong password.'});
				}

			});
		}
	});
});

// route to a restricted info (GET /api/user/updatelocation)
apiRoutes.post('/user/updatelocation', passport.authenticate('jwt', {session: false}), function(req, res) {

	if(!req.body.latitude || !req.body.longitude)
		return res.json({success: false, msg: 'Please pass the latitude and longitude.'});

	// console.dir(req.user);

	User.findById(req.user._id, function(err, user) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		user.latitude = req.body.latitude;
		user.longitude = req.body.longitude;

		user.save(function(err) {

			if (err)
				return res.json({success: false, msg: 'Something went wrong'});

			res.json({success: true, msg: 'Successful updated user location.'});

		});

	});

});

// route to a restricted info (POST /api/user/find)
apiRoutes.post('/user/find', passport.authenticate('jwt', {session: false}), function(req, res) {

	User.findOne({email: req.body.email}, function(err, user) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		if(!user)
			return res.status(403).send({success: false, msg: 'No user found'});

		res.json({success: true, msg: 'User found!', user: user});

	});

});

// route to a restricted info (GET /api/user/findall)
apiRoutes.get('/user/findall', passport.authenticate('jwt', {session: false}), function(req, res) {

	User.find({}, function(err, user) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		if(!user)
			return res.status(403).send({success: false, msg: 'No user found'});

		res.json({success: true, msg: 'User found!', user: user});

	});

});


// route to a restricted info (GET /api/grocery/add)
apiRoutes.post('/grocery/add', passport.authenticate('jwt', {session: false}), function(req, res) {

	if(!req.body.name) {

		res.json({success: false, msg: 'Please pass email and password.'});

	} else {

		var newGroceryIem = new Grocery({
			name: req.body.name,
			userid: req.user._id,
			completed: 0
		});

		// save the item
		newGroceryIem.save(function(err, groceryItem) {

			if(err)
				return res.json({success: false, msg: 'Something went wrong'});

			res.json({success: true, msg: 'Added the item to your list.', list: groceryItem});
		});
	}

});

// route to a restricted info (GET /api/grocery/list)
apiRoutes.get('/grocery/list', passport.authenticate('jwt', {session: false}), function(req, res) {

	Grocery.find({userid: req.user._id}, function(err, groceryList) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		if(!groceryList)
			return res.status(403).send({success: false, msg: 'No list found'});

		res.json({success: true, msg: 'Lists found!', list: groceryList});

	});

});


// connect the api routes under /api/*
app.use('/v1', apiRoutes);