const mongoose=require('mongoose')
mongoose.connect("mongodb://localhost:27017/Campus")
.then(()=>{
    console.log("mongodb connected");
})
.catch(()=>{
    console.log("failed to connect");
})
const LogInSchema=new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    user:{
        type:String,
        required:true
    }
})
const RegisterSchema=new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    usertype:{
        type:String,
        required:true
    },
    password: {
        type: String,
        required: true
    },
    profilePhoto: {
        data: Buffer, // For storing the image data
        contentType: String // For storing the MIME type of the image
    },
    categories:[String]
    
})
const AnnouncementSchema=new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    announcement: {
        type: String,
        required: true
    }
})
const contactschema=new mongoose.Schema({
    Fname:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    phone:{
        type:String,
        required:true
    },
    subject:{
        type:String,
        required:true
    },
    query:{
        type:String,
        required:true
    }
})
const EventSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    clubname: {
        type: String,
        required: true
    },
    eventname: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    eventdate: {
        type: String,
        required: true
    },
    cheif:{
        type:String
    },
    eventdeadline: {
        type: String,
        required: true
    },
    eventfee: {
        type: String,
        required: true
    },
    eventrewards: {
        type: String,
        required: true
    },
    team: {
        type: String,
        required: true
    },
    poster: {
        data: Buffer,
        contentType: String
    },
    paymentQR: {
        data: Buffer, 
        contentType: String 
    },
    contact: {
        type: String,
        required: true
    },
    eligibility: {
        type: String,
        required: true
    },
    outcome: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    faqs: [{
        question: {
            type: String,
            required: false
        },
        answer: {
            type: String,
            required: false
        }
    }],
    customFields: [
        {
          fieldLabel: String,
          fieldType: String,
          isRequired: Boolean,
        },
      ]
});

const registrationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'ClubEvents', required: true },
    teammates: [{
      name: { type: String, required: true },
      email: { type: String, required: true },
      mobile: { type: String, required: true },
      rollno: { type: String, required: true },
      year: { type: String, required: true },
      branch: { type: String, required: true }
    }],
    customFields: [{
      fieldLabel: { type: String, required: true },
      value: { type: String } // Or other types as needed
    }]
  });
  
const Registration = mongoose.model('Registration', registrationSchema);

const LogIn=mongoose.model("LogIn",LogInSchema);
const Registeration=mongoose.model("Registeration",RegisterSchema)
const ClubAnnouncement=mongoose.model("ClubAnnouncement",AnnouncementSchema)
const ClubEvents=mongoose.model("ClubEvents",EventSchema)
const ContactUs=mongoose.model("ContactUs",contactschema)
module.exports={LogIn,Registeration,ClubAnnouncement,ClubEvents,ContactUs,Registration}