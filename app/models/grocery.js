var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
var GrocerySchema = new Schema({
  	name: {
		type: String,
		required: true
	},
  	userid: {
		type: Schema.ObjectId,
		required: true,
		ref: 'user'
	},
	completed: {
		type: Number,
		required: true
	}
});


module.exports = mongoose.model('Grocery', GrocerySchema);