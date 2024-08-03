const express = require('express');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('./database'); // Import the User model
const File = require('./models/file'); // Import the File model
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async function(username, password, done) {
    try {
      const user = await User.findOne({ username });
      if (!user) {
        return done(null, false, { message: 'Incorrect Username.' });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: 'Incorrect Password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await User.create({ username, password: hashedPassword });
    res.redirect('/login');
  } catch (err) {
    res.redirect('/register');
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}


app.post('/upload', ensureAuthenticated, upload.single('file'), async (req, res) => {
  const { originalname, path: tempPath, mimetype, size } = req.file;
  const targetPath = path.join(__dirname, './files/', originalname);

  try {
    fs.rename(tempPath, targetPath, async (err) => {
      if (err) return res.sendStatus(500);

      // Save file details to the database
      await File.create({
        filename: originalname,
        filepath: targetPath, // Ensure this is correctly passed
        mimetype: mimetype,
        size: size,
        userId: req.user.id
      });

      res.redirect('/');
    });
  } catch (err) {
    res.sendStatus(500);
  }
});

app.get('/download/:filename', ensureAuthenticated, (req, res) => {
  const file = path.join(__dirname, './files/', req.params.filename);
  res.download(file, err => {
    if (err) {
      res.send('Error downloading file');
    }
  });
});

app.get('/', ensureAuthenticated, function(req, res) {
  fs.readdir('./files', function(err, files) {
    if (err) {
      return res.send('Error reading files');
    }
    res.render('index', { files: files });
  });
});

app.get('/file/:filename', ensureAuthenticated, function(req, res) {
  const filename = req.params.filename;
  const fileExtension = path.extname(filename);
  fs.readFile(`./files/${filename}`, "utf-8", function(err, filedata) {
    if (err) {
      return res.send('Error reading file');
    }
    res.render('show', { filename: filename, filedata: filedata, fileExtension: fileExtension });
  });
});

app.get('/edit/:filename', ensureAuthenticated, function(req, res) {
  res.render('edit', { filename: req.params.filename });
});

app.get('/delete/:filename', ensureAuthenticated, function(req, res) {
  res.render('delete', { filename: req.params.filename });
});

app.post('/create', ensureAuthenticated, function(req, res) {
  fs.writeFile(`./files/${req.body.title.split(' ').join('')}.txt`, req.body.details, function(err) {
    if (err) {
      return res.send('Error creating file');
    }
    res.redirect('/');
  });
});

app.post('/edit', ensureAuthenticated, function(req, res) {
  fs.rename(`./files/${req.body.previous}`, `./files/${req.body.new}`, function(err) {
    if (err) {
      return res.send('Error renaming file');
    }
    res.redirect('/');
  });
});

app.post('/delete', ensureAuthenticated, function(req, res) {
  fs.unlink(`./files/${req.body.previous}`, function(err) {
    if (err) {
      return res.send('Error deleting file');
    }
    res.redirect('/');
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/register', function(req, res) {
  res.render('register');
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

app.listen(3000, function() {
  console.log('Server is running on port 3000');
});
