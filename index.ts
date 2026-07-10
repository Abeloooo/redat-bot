import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import dotenv from "dotenv";
import OpenAI from "openai";
import cron from "node-cron";
import fs from "fs";

import {
    getUser,
    saveUser,
    saveConversation,
    getConversationHistory,
    updatePreferences,
    clearMemory,
    addTask,
    getTasks,
    completeTask,
    getPendingReminders,
    saveKnowledge,
    searchKnowledge
} from "./database";

import {
    extractPDF
} from "./knowledge/processor";


dotenv.config();



const BOT_TOKEN =
process.env.BOT_TOKEN;


const GROQ_API_KEY =
process.env.GROQ_API_KEY;



if(!BOT_TOKEN || !GROQ_API_KEY){

    throw new Error(
        "Missing BOT_TOKEN or GROQ_API_KEY"
    );

}



const bot =
new Telegraf<Context>(
    BOT_TOKEN
);




const ai =
new OpenAI({

    apiKey:GROQ_API_KEY,

    baseURL:
    "https://api.groq.com/openai/v1"

});




if(!fs.existsSync("uploads")){

    fs.mkdirSync("uploads");

}







// ===============================
// START
// ===============================


bot.start((ctx)=>{


ctx.reply(
`
Hello, I’m Redat 🤝

Redat means "Supporter".

I am your personal AI advisor designed to help, guide and support you.

You can ask questions, create tasks, save memories and upload documents.


---------------------------


ሰላም፣ እኔ Redat ነኝ 🤝

Redat ማለት "ደጋፊ" ማለት ነው።

እኔ የእርስዎ የግል AI አማካሪ ነኝ።

ጥያቄዎችን መጠየቅ፣ ማስታወሻዎችን ማስቀመጥ፣ ተግባሮችን ማቀድ እና ሰነዶችን መጫን ይችላሉ።


Use /help
`
);


});









// ===============================
// HELP
// ===============================


bot.help((ctx)=>{


ctx.reply(
`
🤖 Redat Commands


/profile
Show your information


/remember text
Save memory


/forget
Delete memory


/task text
Create task


/tasks
Show tasks


/done id
Complete task


/upload
Upload PDF


/help
Commands

`
);


});









// ===============================
// PROFILE
// ===============================


bot.command(
"profile",
(ctx)=>{


const user =
getUser(
ctx.from.id.toString()
);



if(!user){

ctx.reply(
"No memory stored yet."
);

return;

}



ctx.reply(
`
👤 Your Profile


Name:
${user.name || "Unknown"}


Memory:
${user.preferences || "None"}

`
);


});









// ===============================
// REMEMBER
// ===============================


bot.command(
"remember",
(ctx)=>{


const text =
ctx.message.text
.replace("/remember","")
.trim();



if(!text){

ctx.reply(
"Example:\n/remember I like cybersecurity"
);

return;

}



updatePreferences(

ctx.from.id.toString(),

text

);



ctx.reply(
`✅ Remembered:\n${text}`
);


});









// ===============================
// FORGET
// ===============================


bot.command(
"forget",
(ctx)=>{


clearMemory(

ctx.from.id.toString()

);



ctx.reply(
"🧹 Memory deleted."
);


});









// ===============================
// TASKS
// ===============================


bot.command(
"task",
(ctx)=>{


const task =
ctx.message.text
.replace("/task","")
.trim();



if(!task){

ctx.reply(
"Example:\n/task Study Python"
);

return;

}



addTask(

ctx.from.id.toString(),

task

);



ctx.reply(
`✅ Task created:\n${task}`
);


});








bot.command(
"tasks",
(ctx)=>{


const tasks =
getTasks(

ctx.from.id.toString()

);



if(tasks.length===0){

ctx.reply(
"No tasks."
);

return;

}



let msg =
"📋 Tasks:\n\n";



tasks.forEach(
(task:any,index:number)=>{


msg +=
`
${index+1}. ${task.task}

Status:
${task.status}

`;

});



ctx.reply(msg);


});








bot.command(
"done",
(ctx)=>{


const id =
Number(
ctx.message.text
.replace("/done","")
.trim()
);



completeTask(id);



ctx.reply(
"✅ Completed."
);


});









// ===============================
// PDF UPLOAD
// ===============================


bot.command(
"upload",
(ctx)=>{


ctx.reply(
"📚 Send me your PDF file."
);


});







bot.on(
"document",
async(ctx)=>{


try{


const file =
ctx.message.document;



if(!file.file_name?.endsWith(".pdf")){

ctx.reply(
"Only PDF files are supported."
);

return;

}



const telegramFile =
await ctx.telegram.getFile(
file.file_id
);



const url =
`https://api.telegram.org/file/bot${BOT_TOKEN}/${telegramFile.file_path}`;



const response =
await fetch(url);



const data =
await response.arrayBuffer();



const path =
`uploads/${file.file_name}`;



fs.writeFileSync(
path,
Buffer.from(data)
);



const text =
await extractPDF(path);



saveKnowledge(

ctx.from.id.toString(),

file.file_name,

text

);



ctx.reply(
`
✅ PDF saved.

You can now ask questions about it.
`
);


}

catch(error){

console.log(error);

ctx.reply(
"PDF processing failed."
);

}


});









// ===============================
// REMINDER CHECK
// ===============================


cron.schedule(

"* * * * *",

async()=>{


const reminders =
getPendingReminders();



for(
const reminder of reminders as any[]
){


await bot.telegram.sendMessage(

reminder.telegram_id,

`🔔 Reminder:\n${reminder.task}`

);



completeTask(
reminder.id
);


}


});









// ===============================
// AI CHAT WITH MEMORY
// ===============================


bot.on(
message("text"),
async(ctx)=>{


const userId =
ctx.from.id.toString();



const question =
ctx.message.text;



try{


await ctx.sendChatAction(
"typing"
);



// Auto save name

if(
question.toLowerCase()
.includes("my name is")
){


const name =
question
.toLowerCase()
.replace("my name is","")
.trim();



saveUser(

userId,

name

);


}






const user =
getUser(userId);



const history =
getConversationHistory(
userId,
10
);




let chats = "";



(history as any[])
.reverse()
.forEach(chat=>{


chats +=
`
User:
${chat.user_message}

Redat:
${chat.bot_response}

`;

});





const docs =
searchKnowledge(

userId,

question

);



let knowledge = "";



(docs as any[])
.forEach(doc=>{


knowledge +=
doc.content.substring(0,2000);


});








const result =
await ai.chat.completions.create({

model:
"llama-3.3-70b-versatile",



messages:[


{

role:"system",

content:
`
You are Redat.

You are a personal AI assistant.

User memory:

Name:
${user?.name || "Unknown"}

Preferences:
${user?.preferences || "None"}



Previous conversations:

${chats || "No previous chat"}



Documents:

${knowledge || "No documents"}





If user asks their name,
use memory.

Support English and Amharic.

`

},


{

role:"user",

content:question

}


]


});







const answer =
result
.choices[0]
.message
.content || "";





saveConversation(

userId,

question,

answer

);



ctx.reply(answer);



}

catch(error){


console.error(error);



ctx.reply(
"Sorry, Redat is unavailable."
);


}


});









// ===============================
// START BOT
// ===============================


bot.launch();



console.log(
"🤖 Redat is running"
);





process.once(
"SIGINT",
()=>bot.stop("SIGINT")
);


process.once(
"SIGTERM",
()=>bot.stop("SIGTERM")
);