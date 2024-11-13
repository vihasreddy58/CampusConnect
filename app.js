const express = require("express");
const app = express();
const port = 3000;
const fs = require("fs");
const path = require("path");
const http =require("http");
const { Server } = require('socket.io');
const {
  Registeration,
  LogIn,
  ClubAnnouncement,
  ClubEvents,
  ContactUs,
  Registration
} = require("./src/mongodb");

const server = http.createServer(app);
const io = new Server(server);
const { scheduleReminders } = require('./reminderService');
const multer = require("multer");
const utils = require("./utils/utils");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });
const session = require("express-session");
const crypto = require("crypto");
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "returnright.info@gmail.com",
    pass: "rqup ggrr zcmg bqjh",
  },
});
const generateSecret = () => {
  return crypto.randomBytes(16).toString("hex");
};

const sessionSecret = generateSecret();
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
  })
);
const bodyParser = require('body-parser');
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

app.use((req, res, next) => {
  res.locals.page = "";
  next();
});
const registeredUsers = {}; // { eventId: { socketId: true } }

// Handle user registration for an event

io.on('connection', (socket) => {
  console.log('A user connected: ' + socket.id);

  // Listen for user joining the chat for a specific event
  socket.on('register', (eventId) => {
    if (registeredUsers[eventId] && registeredUsers[eventId][socket.id]) {
      socket.join(eventId);
      console.log(`User ${socket.id} joined event room ${eventId}`);
      socket.emit('registration-success', { success: true, eventId: eventId });
    } else {
      console.log(`User ${socket.id} is not registered for event ${eventId}`);
      socket.emit('not registered', eventId);
    }
  });

  // Handle chat messages
  socket.on('chat message', (eventId, msg) => {
    io.to(eventId).emit('chat message', msg);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.id);
  });
});
app.get('/chat/:eventId', (req, res) => {
  const { eventId } = req.params;
  res.render('chat', { eventId });
});

app.post("/register", async (req, res) => {
  const { username, fullName, email, usertype, password ,categories} = req.body;
  const existingUser = await Registeration.findOne({ username });
  if (existingUser) {
    return res.render("register", { error: "Username already exists" });
  }
  const newUser = new Registeration({
    username,
    fullName,
    email,
    usertype,
    password,
    categories
  });
  await newUser.save();
  res.render("login");
});
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await Registeration.findOne({ username });
    const announcedetails = await ClubAnnouncement.find();
    const events = await ClubEvents.find();
    console.log("Announcements:", announcedetails); // Log announcements
    console.log("User:", req.session.user); // Log user session
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (user.password === password) { 
      req.session.user = {
        id: user._id,
        username: user.username,
        usertype: user.usertype, 
      };
      
    res.render("index", { announcedetails, events, user });
    } else {
      res.status(401).send("Wrong password");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request");
  }
});

app.post("/addannouncement", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
  const user = await Registeration.findById(userId);
  console.log(req.body);
  const data = {
    username: req.body.username,
    announcement: req.body.announcement,
  };
  await ClubAnnouncement.insertMany([data]);
  const announcedetails = await ClubAnnouncement.find();
  res.render("index", { announcedetails, user });
});
app.get("/addannouncement", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
  const user = await Registeration.findById(userId);
  const announcements = await ClubAnnouncement.find({
    username: req.session.user.username,
  });
  res.locals.page = "addannouncement";
  res.render("addannouncement", { announcements, user});
});
app.get("/addevent", (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
  const user =  Registeration.findById(userId);
  res.locals.page = "addevent";
  res.render("addevent", { user});
});
app.get("/index", async (req, res) => {
  try {
    const announcedetails = await ClubAnnouncement.find();
    const events = await ClubEvents.find();
    const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
    console.log("Announcements:", announcedetails); // Log announcements
    console.log("User:", req.session.user); // Log user session
    res.locals.page = "index";
    res.render("index", { announcedetails, events, user });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/addevent", upload.fields([
  { name: 'poster', maxCount: 1 },
  { name: 'paymentQR', maxCount: 1 }
]), async (req, res) => {
  try {
    const announcedetails = await ClubAnnouncement.find();
    const events = await ClubEvents.find();
    console.log(req.body);

    let posterData = null;
    let paymentQRData = null;

    // Handle poster image
    if (req.files && req.files['poster'] && req.files['poster'][0]) {
      const posterFile = req.files['poster'][0];
      posterData = {
        data: fs.readFileSync(path.join(__dirname, '/uploads/' + posterFile.filename)),
        contentType: posterFile.mimetype,
      };
    }

    // Handle payment QR image
    if (req.files && req.files['paymentQR'] && req.files['paymentQR'][0]) {
      const paymentQRFile = req.files['paymentQR'][0];
      paymentQRData = {
        data: fs.readFileSync(path.join(__dirname, '/uploads/' + paymentQRFile.filename)),
        contentType: paymentQRFile.mimetype,
      };
    }

    // Handle FAQs and Custom Fields as per your existing logic
    const faqs = [];
    for (let i = 1; req.body[`faq${i}`] && req.body[`faq${i}_answer`]; i++) {
      faqs.push({
        question: req.body[`faq${i}`],
        answer: req.body[`faq${i}_answer`],
      });
    }

    const customFields = [];
    for (let i = 1; req.body[`fieldLabel${i}`]; i++) {
      if (req.body[`fieldLabel${i}`]) {
        customFields.push({
          fieldLabel: req.body[`fieldLabel${i}`],
          fieldType: req.body[`fieldType${i}`],
          isRequired: req.body[`isRequired${i}`] === 'on', // Check if checkbox is checked
        });
      }
    }

    // Example of saving eventData with two images
    const eventData = {
      clubname: req.body.clubname,
      eventname: req.body.eventname,
      category: req.body.category,
      description: req.body.description,
      location: req.body.location,
      eventdate: req.body.eventdate,
      eventdeadline: req.body.eventdeadline,
      eventfee: req.body.eventfee,
      eventrewards: req.body.eventrewards,
      team: req.body.team,
      eligibility: req.body.eligibility,
      contact: req.body.contact,
      cheif: req.body.cheif,
      outcome: req.body.outcome,
      link: req.body.link,
      paymentQR: paymentQRData,
      poster: posterData,
      faqs: faqs,
      customFields: customFields
    };

    await ClubEvents.insertMany([eventData]);

    // Send notification emails as per your existing logic
    const interested = await Registeration.find({ categories: eventData.category ,usertype:"student" });
    const emailTemplatePath = path.join(__dirname, 'emails', 'emailTemplate.html');
    const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');
    const emailHtml = emailTemplate
      .replace('{{eventName}}', eventData.eventname)
      .replace('{{clubName}}', eventData.clubname)
      .replace('{{description}}', eventData.description)
      .replace('{{location}}', eventData.location)
      .replace('{{eventDate}}', eventData.eventdate)
      .replace('{{eventFee}}', eventData.eventfee)
      .replace('{{contact}}', eventData.contact);

    const mailOptions = {
      from: "returnright.info@gmail.com", // your email
      to: interested.map(user => user.email), // recipient's emails
      subject: `New Event: ${eventData.eventname}`,
      html: emailHtml,
      attachments: [
        {
          filename: req.files['poster'][0].originalname,
          content: fs.createReadStream(req.files['poster'][0].path),
        },
      ],
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        res.send('Error occurred while sending email');
      } else {
        console.log('Email sent: ' + info.response);
        res.redirect("/home");
      }
    });

    res.render("index", { announcedetails, events, user: req.session.user });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
app.get("/profile", async (req, res) => {
  try {
    // Check if the user is logged in
    if (!req.session.user) {
      return res.redirect("/login"); 
    }

    const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId); 
    if (!user) {
      return res.status(404).send("User not found"); 
    }

    // Fetch registrations and populate event details
    const registrations = await Registration.find({ user: userId }).populate('event');

    // Log registrations for debugging (optional)
    registrations.forEach(registration => {
      console.log(`Registered Event: ${registration.event.eventname}`);
    });

    // Render the profile page with user and registrations data
    res.render("profile", { user, registrations, page: "profile" }); 
  } catch (error) {
    console.error("Error in /profile route:", error);
    res.status(500).send("An error occurred while processing your request");
  }
});


app.post('/updateprofile', upload.single('profilePhoto'), async (req, res) => {
  try {
    const userId = req.session.user.id; // Get user ID from session
    const { fullName, email, username, categories } = req.body;

    // Prepare data to update
    const updateData = {
      fullName,
      email,
      username,
      categories: categories.split(',').map(cat => cat.trim()) // Convert categories to an array
    };

    // If a new profile photo is uploaded, add it to the update data
    if (req.file) {
      updateData.profilePhoto = {
        data: fs.readFileSync(req.file.path), // Read file data as Buffer
        contentType: req.file.mimetype // Get content type
      };
    }

    // Update the user profile in MongoDB
    const updatedUser = await Registeration.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      return res.status(404).send('User not found');
    }

    // Update the session with the new data
    req.session.user = { ...req.session.user, ...updateData };

    res.redirect('/profile'); // Redirect to the profile page
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('An error occurred while updating your profile');
  }
});

// Route to get the edit profile page
app.get("/editprofile", async (req, res) => {
  try {
    // Check if the user is logged in
    if (!req.session.user) {
      return res.redirect("/login"); // Redirect to login if not authenticated
    }

    const userId = req.session.user.id; // Get user ID from session
    // Fetch the user details
    const user = await Registeration.findById(userId); 
    if (!user) {
      return res.status(404).send("User not found"); 
    }

    // Render the edit profile page with user data
    res.render("editprofile", { user, page: "editprofile" }); 
  } catch (error) {
    console.error("Error in /editprofile route:", error);
    res.status(500).send("An error occurred while processing your request");
  }
});


app.get("/events", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
  try {
    const events = await ClubEvents.find();

    res.render("events", {
      events,
      getCategoryIcon: utils.getCategoryIcon,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request");
  }
});
app.get('/eventregister/:id', async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
  try {
    const event = await ClubEvents.findById(req.params.id);
    if (!event) {
      return res.status(404).send('Event not found');
    }
    res.render('eventregister', { event, user });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while processing your request');
  }
});
app.post('/registerevent/:id', async (req, res) => {
  try {
      const eventId = req.params.id;
      console.log(`Received eventId: ${eventId}`);
      console.log('Request body:', req.body);
      
      const socketId = req.body.socketId; // This should be sent from the client

      if (!registeredUsers[eventId]) {
          registeredUsers[eventId] = {};
      }

      registeredUsers[eventId][socketId] = true; // Mark the socket ID as registered for the event

      // Find the event by ID
      const event = await ClubEvents.findById(eventId);
      if (!event) {
          console.log(`Event with ID ${eventId} not found`);
          return res.status(404).json({ error: 'Event not found' }); // Return early if not found
      }
      console.log(`Found event: ${event.eventname}`);

      // Collect teammate data
      const teammates = [];
      for (let i = 0; i < event.team; i++) {
          const teammateData = {
              name: req.body[`teammate${i + 1}_name`] || '',
              email: req.body[`teammate${i + 1}_email`] || '',
              mobile: req.body[`teammate${i + 1}_mobile`] || '',
              rollno: req.body[`teammate${i + 1}_rollno`] || '',
              year: req.body[`teammate${i + 1}_year`] || '',
              branch: req.body[`teammate${i + 1}_branch`] || '',
          };
          console.log(`Teammate ${i + 1}:`, teammateData);

          // Add only valid teammates
          if (Object.values(teammateData).some(value => value)) {
              teammates.push(teammateData);
          }
      }
      console.log('Teammates:', teammates);

      // Collect custom field data
      const customFields = event.customFields.map(field => ({
          fieldLabel: field.fieldLabel,
          value: req.body[field.fieldLabel] || '',
      }));
      console.log('Custom Fields:', customFields);

      // Save registration to the database
      const registration = await Registration.create({
          user: req.session.user.id,  // Assuming session holds user data
          event: event._id,
          teammates,
          customFields,
      });

      console.log('Registration successful.');

      // Send immediate confirmation emails to all teammates
      const eventDate = event.date; // Make sure to get the event date
      const teammateEmails = teammates.map(teammate => teammate.email); // Extract emails

      // Send confirmation email to each teammate
      await Promise.all(teammateEmails.map(email => sendConfirmationEmail(email, event.eventname, eventDate)));

      // Schedule reminder for the user
      scheduleReminders(event, teammates); // Assuming the session has user's email

      // Send JSON response instead of redirecting
      res.json({ success: true, eventId: eventId }); // Send success response
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Function to send confirmation email
async function sendConfirmationEmail(to, eventName, eventDate) {
  const subject = `Registration Confirmation: ${eventName}`;
  const text = `
    Dear User,

    Thank you for registering for the event: "${eventName}".

    Event Details:
    - Name: ${eventName}
        - Date: ${eventDate ? new Date(eventDate).toLocaleString() : 'Not specified'}


    We look forward to seeing you there!

    Best Regards,
    Your Event Team
  `;

  console.log(`Sending confirmation email to: ${to}`); // Log to confirm email sending

  try {
    await transporter.sendMail({
      from: 'returnright.info@gmail.com',  // Use your email address
      to,
      subject,
      text,
    });
    console.log(`Confirmation email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send confirmation email to ${to}:`, error);
  }
}



app.get('/my-events', async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
 
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).send('User not authenticated');
    }
    const userId = req.session.user.username;
    const events = await ClubEvents.find({ clubname: userId });
    if (!events.length) {
      return res.status(404).send('No events found for the user');
    }
    const registrations = await Registration.find({ event: { $in: events.map(event => event._id) } });
    const eventRegistrations = events.reduce((acc, event) => {
      acc[event._id] = registrations.filter(reg => reg.event.toString() === event._id.toString());
      return acc;
    }, {});
    res.render('my-events', { events, eventRegistrations,user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


app.get("/calendar", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
 
  try {
    const events = await ClubEvents.find(); // Adjust your query as needed
    res.render("calendar", { events, user });
  } catch (err) {
    res.status(500).send("Error fetching events: " + err.message);
  }
});

app.get("/events/:id", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
 
  try {
    const event = await ClubEvents.findById(req.params.id);
    res.render("eventdet", { event, user });
  } catch (err) {
    console.error("Error retrieving hostel details:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/", (req, res) => {
  res.locals.page = "login";
  res.render("login");
});
app.get("/eventdet", (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user =  Registeration.findById(userId);
 
  res.locals.page = "eventdet";
  res.render("eventdet",{user});
});
app.get("/register", (req, res) => {
  res.locals.page = "register";
  res.render("register");
});
app.get("/myevents", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
 
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }
    const events = await ClubEvents.find({
      clubname: req.session.user.username,
    });
    res.locals.page = "myevents";
    res.render("myevents", { events, user });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
app.post("/deleteevent", async (req, res) => {
  try {
    const itemId = req.body.itemId;
    const event = await ClubEvents.findById(itemId);
    if (!event) {
      return res.status(404).send("Item not found");
    }
    if (event.clubname !== req.session.user.username) {
      return res.status(403).send("Unauthorized to delete this item");
    }
    await ClubEvents.findByIdAndDelete(itemId);
    res.redirect("index");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request");
  }
});
app.get("/editevent/:id", async (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user = await Registeration.findById(userId);
 
  try {
    const event = await ClubEvents.findById(req.params.id);
    if (!event) {
      return res.status(404).send("Event not found");
    }
    event.eventdate =
      event.eventdate instanceof Date
        ? event.eventdate
        : new Date(event.eventdate);
    res.render("edit", { event, user });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request");
  }
});
app.post("/editevent/:id", upload.single("poster"), async (req, res) => {
  try {
    const updatedEventData = req.body;
    if (req.file) {
      updatedEventData.poster = "/uploads/" + req.file.filename;
    }
    const event = await ClubEvents.findByIdAndUpdate(
      req.params.id,
      updatedEventData,
      { new: true }
    );
    if (!event) {
      return res.status(404).send("Event not found");
    }
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request");
  }
});
app.post("/deleteannouncement", async (req, res) => {
  try {
    const itemId = req.body.itemId;
    const announcements = await ClubAnnouncement.findById(itemId);
    if (!announcements) {
      return res.status(404).send("Item not found");
    }
    if (announcements.username !== req.session.user.username) {
      return res.status(403).send("Unauthorized to delete this item");
    }
    await ClubAnnouncement.findByIdAndDelete(itemId);
    res.redirect("index");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request");
  }
});
app.post("/contactus", async (req, res) => {
  try {
    console.log(req.body);
    const data = {
      Fname: req.body.Fname,
      email: req.body.email,
      phone: req.body.phone,
      subject: req.body.subject,
      query: req.body.query,
    };
    await ContactUs.insertMany([data]);
    res.render("index", { announcedetails, events, user: req.session.user });
  } catch (err) {
    console.log(err);
  }
});
app.get("/navbarstu", (req, res) => {
  res.locals.page = "navbarstu";
  console.log(user.profilePhoto)
  const userId = req.session.user.id; 
    // Fetch the user details
  const user =  Registeration.findById(userId); 
  res.render("navbarstu", { user});
});


app.get("/navbarcl", (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user =  Registeration.findById(userId);
 
  res.locals.page = "navbarcl";
  res.render("navbarcl", { user });
});
app.get("/footer", (req, res) => {
  res.locals.page = "footer";
  res.render("footer");
});
app.get("/contactus", (req, res) => {
  const userId = req.session.user.id; 
    // Fetch the user details
    const user =  Registeration.findById(userId);
 
  res.locals.page = "contactus";
  res.render("contactus", { user});
});

function formatEventDetails(event) {
  return `
    Club Name: ${event.clubname}
    Event Name: ${event.eventname}
    Category: ${event.category}
    Description: ${event.description}
    Location: ${event.location}
    Event Date: ${event.eventdate}
    Event Deadline: ${event.eventdeadline}
    Event Fee: ${event.eventfee}
    Event Rewards: ${event.eventrewards}
    Team: ${event.team}
    Eligibility: ${event.eligibility}
    Contact: ${event.contact}
    Chief Guest: ${event.cheif}
    Expected Outcome: ${event.outcome}
    Registration Link: ${event.link}
    FAQs:
    ${event.faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n")}
  `;
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
