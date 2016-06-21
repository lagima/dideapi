var express = require("express");
var fs = require("fs");
// var http = require('http');
var https = require('https');
var socketio = require("socket.io");
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
var socketioJwt = require('socketio-jwt');

// Initialise the app
var app = express();

// Initialise the server
var options = {
	key: fs.readFileSync('./server.key'),
	cert: fs.readFileSync('./server.crt')
};
var server = https.createServer(options, app);

// var server = http.createServer(app);
var io = socketio.listen(server, options);

// Some placeholders for socket io
var connections = [];
var users = [];

// get our request parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// log to console
app.use(morgan('dev'));

// Use the passport package in our application
app.use(passport.initialize());

// Start the server
server.listen(port);
console.log('There will be dragons: http://api.pickatask.com:' + port);

// connect to database
mongoose.connect(config.database);

// pass passport for configuration
require('./config/passport')(passport);

// Global routes.....

// Welcome route
app.get('/', function(req, res) {
	res.send('Hello! The API is at http://api.pickatask.com:' + port + '/api');
});

// Socketio test
app.get('/io', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

// bundle our routes
var apiRoutes = express.Router();

// create a new user account (POST /api/user/signup)
apiRoutes.post('/user/signup', function(req, res) {

	if(!req.body.email || !req.body.password || !req.body.type) {

		res.json({success: false, msg: 'Please pass email and password.'});

	} else {

		var newUser = new User({
			email: req.body.email,
			password: req.body.password,
			type: req.body.type
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
					res.json({success: true, token: token, user: user});
				} else {
					res.send({success: false, msg: 'Authentication failed. Wrong password.'});
				}

			});
		}
	});
});

// route to a restricted info (GET /api/user/updatelocation)
apiRoutes.post('/user/updatelastlocation', passport.authenticate('jwt', {session: false}), function(req, res) {

	if(!req.body.latitude || !req.body.longitude)
		return res.json({success: false, msg: 'Please pass the latitude and longitude.'});

	User.findById(req.user._id, function(err, user) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		// console.dir(user);

		user.latitude = req.body.latitude;
		user.longitude = req.body.longitude;

		user.save(function(err) {

			if (err)
				return res.json({success: false, msg: 'Something went wrong while saving'});

			// Broadcast this update
			data = {userid: user._id, latitude: user.latitude, longitude: user.longitude}
			io.sockets.emit('locationupdate', data);

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

// route to a restricted info (GET /api/user/friends)
apiRoutes.get('/user/friends', passport.authenticate('jwt', {session: false}), function(req, res) {

	User.find({_id: {$ne: req.user._id}}, function(err, users) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		if(!users)
			return res.status(403).send({success: false, msg: 'No friends found'});

		res.json({success: true, msg: 'Friends found!', list: users});

	});

});


// route to a restricted info (GET /api/grocery/add)
apiRoutes.post('/grocery/add', passport.authenticate('jwt', {session: false}), function(req, res) {

	if(!req.body.name) {

		res.json({success: false, msg: 'Please pass name of item.'});

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

			// Push the update to all devices
			io.sockets.emit('groceryadd', {list: groceryItem});

			res.json({success: true, msg: 'Added the item to your list.', list: groceryItem});
		});
	}

});

// route to a restricted info (POST /api/grocery/update)
apiRoutes.post('/grocery/update', passport.authenticate('jwt', {session: false}), function(req, res) {

	if(!req.body.id)
		return res.json({success: false, msg: 'Please pass item id.'});

	Grocery.findById(req.body.id, function(err, groceryItem) {

		if(err || !groceryItem)
			return res.json({success: false, msg: 'Something went wrong'});

		groceryItem.completed = req.body.completed;

		groceryItem.save(function(err) {

			if (err)
				return res.json({success: false, msg: 'Something went wrong'});

			// Push the update to all devices
			io.sockets.emit('groceryupdate', {list: groceryItem});

			res.json({success: true, msg: 'Successful updated grocery item.', list: groceryItem});

		});

	});

});

// route to a restricted info (POST /api/grocery/update)
apiRoutes.post('/grocery/delete', passport.authenticate('jwt', {session: false}), function(req, res) {

	if(!req.body.id)
		return res.json({success: false, msg: 'Please pass item id.'});

	Grocery.findById(req.body.id, function(err, groceryItem) {

		if(err || !groceryItem)
			return res.json({success: false, msg: 'Something went wrong'});

		var deletedItem = groceryItem;

		groceryItem.remove(function(err) {

			if (err)
				return res.json({success: false, msg: 'Something went wrong'});

			// Push the update to all devices
			io.sockets.emit('grocerydelete', {success: true, msg: 'Successful deleted grocery item.', list: deletedItem});

			res.json({success: true, msg: 'Successful deleted grocery item.', list: deletedItem});

		});

	});

});

// route to a restricted info (GET /api/grocery/list)
apiRoutes.get('/grocery/list', passport.authenticate('jwt', {session: false}), function(req, res) {

	Grocery.find({}, function(err, groceryList) {

		if(err)
			return res.json({success: false, msg: 'Something went wrong'});

		if(!groceryList)
			return res.status(403).send({success: false, msg: 'No list found'});

		res.json({success: true, msg: 'Lists found!', list: groceryList});

	});

});


// connect the api routes under /api/*
app.use('/v1', apiRoutes);


// Socket IO stuffs...
io.sockets.use(socketioJwt.authorize({
	secret: config.secret,
	handshake: true
}));

io.sockets.on('connection', function(socket) {

	// Push it to the connections
	connections.push(socket);

	console.log('Connected & authenticated: %s, total connections is %s', socket.decoded_token.email, connections.length);

	// Disconnect
	socket.on('disconnect', function(data) {
		connections.splice(connections.indexOf(socket), 1);
		console.log('Disconnected: %s, total connections is %s', socket.decoded_token.email, connections.length);
	});

	socket.on('requeststartlocation', function(data) {
		socket.broadcast.emit('startlocationupdate', data);
		console.log("Sending location updates of %s", data.userid);
	});

	socket.on('requeststoplocation', function(data) {
		socket.broadcast.emit('stoplocationupdate', data);
		console.log("Stopping location updates of %s", data.userid);
	});

	socket.on('sendlocation', function(data) {
		socket.broadcast.emit('locationupdate', data);
		console.log("Location updates from %s", data.userid);
	});

});


