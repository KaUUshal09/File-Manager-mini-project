const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/fileManager',{
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
});

const userSchema  = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
    },
  password: { 
    type: String,
     required: true 
    },
});


const User = mongoose.model('User',userSchema);

module.exports = User;