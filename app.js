const express = require("express");  // module to create http servers
const {google} =require('googleapis'); // module to use google API's
const dotenv=require("dotenv"); // To parse .env variables
const path= require("path"); // to create file path
dotenv.config()
const app =express();
const {authenticate} = require('@google-cloud/local-auth');
const fs= require("fs").promises  // to read credentials stored from file


// Collection of scopes(permissions) which will give use diffent types of accessibilty to perform read, modify and write into gmail mailbox
const scopes =["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.send","https://www.googleapis.com/auth/gmail.labels","https://mail.google.com/"]


// Label name which will be created 
let LABEL_NAME="Auto_Replied"  

// request handler for the first login request from http://localhost:3000
app.get('/', async(req,res)=>{

    const credentials = await fs.readFile('credentials.json');   // reading credentials from json file downloaded from google api manager site

    // Authenticating for required scope using credentials like clientId, secret and auth url
    const auth = await authenticate({
        keyfilePath:path.join(__dirname, 'credentials.json'),
        scopes:scopes
    });

    // Here, we create a gmail object
    const gmail = google.gmail({version:'v1',auth});
  
    // here fetching names of all labels present in mailbox
    const response = await gmail.users.labels.list({userId:'me'});
   



    // function to read and parse saved credentials from file if available
async function loadCredentials(){
    const filePath = path.join(process.cwd(),'credentials.json');
    const content = await fs.readFile(filePath, {encoding:'utf8'});
    return JSON.parse(content);
}

//This function helps in fetching all the unread messages, which have not been replied
async function getUnrepliedMessages(auth)
{
    const gmail = google.gmail({version:'v1',auth});
    const res = await gmail.users.messages.list({
        userId:'me',
        q:'-in:chats -from:me -has:userlabels',    // this is the filter which filters all the unread messages
    });
    return res.data.messages||[];
}

//This function helps in sending reply to a selected message id.
async function sendReply(auth,message){
    const gmail = google.gmail({version:'v1',auth});

    // getting details of message
    const res = await gmail.users.messages.get({
        userId:'me',
        id:message.id,
        format:'metadata',
        metadataHeaders:['Subject','From'],
    });
    const subject = res.data.payload.headers.find((header)=>header.name === 'Subject').value; // extracting subject from email
    const from = res.data.payload.headers.find((header)=>header.name==='From').value; // sender email address
    const replyTo = from.match(/<(.*)>/)[1]; 
    const replySubject =subject.startsWith('Re:')?subject:`Re:${subject}`;
    const replyBody = `Hi,\n\n I'm currently on vacation and will get back to you soon. \n\nBest. \nYour Name`;
    const rawMessage =[
        `From:me`,
        `To:${replyTo}`,
        `Subject:${replySubject}`,
        `In-Reply-To:${message.id}`,
        `References:${message.id}`,
        ``,
        replyBody,
    ].join('\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g,'_').replace(/=+$/, '');// encoding mail to base64
    await gmail.users.messages.send({
        userId:'me',
        requestBody:{
            raw:encodedMessage,
        },
    })
}

// This function helps in modifying lebel of a messege
async function addLabel(auth,message,labelId){
    const gmail = google.gmail({version:'v1',auth});
    await gmail.users.messages.modify({
        userId:'me',
        id:message.id,
        requestBody:{
            addLabelIds:[labelId],
            removeLabelIds:['INBOX'],
        },
    })
}

// This function helps in creating a new label into mailbox
async function createLabel(auth){
    const gmail= google.gmail({version:'v1',auth});
    try{
        const res = await gmail.users.labels.create({
            userId:'me',
            requestBody:{
                name:LABEL_NAME,
                labelListVisibility:'labelShow',
                messageListVisibility:'show',
            },
        })
        return res.data.id;
    }
    catch(err)
    {
        if(err.code===409)
        {
            // label already exists
            const res =await gmail.users.labels.list({
                userId:'me',
            });
            const label = res.data.labels.find((label)=>label.name === LABEL_NAME);
            return label.id;
        }
        else
        {
            throw err;
        }
    }
}

//The main function which checks for unread messages, replies and add's label to the replied message

async function StartAutoReplying(){
    //Creates a label inside the mailbox
    const labelId = await createLabel(auth);
    console.log(`created or found label with id ${labelId}`);

    // Repeat the following steps in random intervals between 45 to 120 seconds
    setInterval(async()=>{
        // gets messages that have no prior replies
        const messages = await getUnrepliedMessages(auth);
        console.log(`Found ${messages.length} unreplied messages`);

        // Looping through all the unread messages
        for(const message of messages){
            // Sending reply to the message
            await sendReply(auth,message);
            console.log(`Sent reply to message with id ${message.id}`)

            // Adding label to the message and move it to the label folder
            await addLabel(auth,message,labelId);
            console.log(`Added label to message with id ${message.id}`);
        }
    }, (Math.floor(Math.random(120-45+1)+45)*1000))
}

StartAutoReplying().catch(console.error)  // called the main function 
const labels=response.data.labels
res.send("Hi! Login successful. Your emails will be replied successfully")
});



module.exports=app;