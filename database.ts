import Database from "better-sqlite3";


// ===============================
// TYPES
// ===============================

export interface User {

    id: number;

    telegram_id: string;

    name: string | null;

    preferences: string | null;

    created_at: string;

}




// ===============================
// DATABASE CONNECTION
// ===============================

const db = new Database("redat.db");




// ===============================
// TABLE CREATION
// ===============================


db.exec(`

CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT UNIQUE NOT NULL,

    name TEXT,

    preferences TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);





db.exec(`

CREATE TABLE IF NOT EXISTS conversations (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT NOT NULL,

    user_message TEXT NOT NULL,

    bot_response TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);





db.exec(`

CREATE TABLE IF NOT EXISTS tasks (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT NOT NULL,

    task TEXT NOT NULL,

    status TEXT DEFAULT 'pending',

    reminder_time DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);





db.exec(`

CREATE TABLE IF NOT EXISTS knowledge (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT NOT NULL,

    filename TEXT NOT NULL,

    content TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);








// ===============================
// USER MEMORY FUNCTIONS
// ===============================



export function getUser(

    telegramId:string

): User | undefined {


    return db.prepare(

        `
        SELECT *

        FROM users

        WHERE telegram_id=?

        `

    )
    .get(telegramId) as User | undefined;


}







export function saveUser(

    telegramId:string,

    name:string

):void {


    const user =
    getUser(telegramId);



    if(user){


        db.prepare(

            `
            UPDATE users

            SET name=?

            WHERE telegram_id=?

            `

        )
        .run(

            name,

            telegramId

        );


    }

    else{


        db.prepare(

            `
            INSERT INTO users

            (
                telegram_id,
                name
            )

            VALUES (?,?)

            `

        )
        .run(

            telegramId,

            name

        );


    }


}








export function updatePreferences(

    telegramId:string,

    preference:string

):void {


    const user =
    getUser(telegramId);



    if(!user){


        db.prepare(

            `
            INSERT INTO users

            (
                telegram_id,
                preferences
            )

            VALUES (?,?)

            `

        )
        .run(

            telegramId,

            preference

        );


        return;

    }




    const oldPreference =
    user.preferences || "";




    const updated =

        oldPreference

        ?

        `${oldPreference}, ${preference}`

        :

        preference;





    db.prepare(

        `
        UPDATE users

        SET preferences=?

        WHERE telegram_id=?

        `

    )
    .run(

        updated,

        telegramId

    );


}








export function clearMemory(

    telegramId:string

):void {


    db.prepare(

        `
        UPDATE users

        SET

        name=NULL,

        preferences=NULL

        WHERE telegram_id=?

        `

    )
    .run(

        telegramId

    );


}









// ===============================
// CONVERSATION MEMORY
// ===============================



export function saveConversation(

    telegramId:string,

    userMessage:string,

    botResponse:string

):void {


    db.prepare(

        `
        INSERT INTO conversations

        (

            telegram_id,

            user_message,

            bot_response

        )

        VALUES (?,?,?)

        `

    )
    .run(

        telegramId,

        userMessage,

        botResponse

    );


}







export function getConversationHistory(

    telegramId:string,

    limit:number = 10

){


    return db.prepare(

        `
        SELECT *

        FROM conversations

        WHERE telegram_id=?

        ORDER BY id DESC

        LIMIT ?

        `

    )
    .all(

        telegramId,

        limit

    );


}









// ===============================
// TASK FUNCTIONS
// ===============================



export function addTask(

    telegramId:string,

    task:string

):void {


    db.prepare(

        `
        INSERT INTO tasks

        (

            telegram_id,

            task

        )

        VALUES (?,?)

        `

    )
    .run(

        telegramId,

        task

    );


}







export function getTasks(

    telegramId:string

){


    return db.prepare(

        `
        SELECT *

        FROM tasks

        WHERE telegram_id=?

        ORDER BY id DESC

        `

    )
    .all(

        telegramId

    );


}







export function completeTask(

    id:number

):void {


    db.prepare(

        `
        UPDATE tasks

        SET status='completed'

        WHERE id=?

        `

    )
    .run(id);


}








export function getPendingReminders(){


    return db.prepare(

        `
        SELECT *

        FROM tasks

        WHERE status='pending'

        AND reminder_time <= datetime('now')

        AND reminder_time IS NOT NULL

        `

    )
    .all();


}









// ===============================
// KNOWLEDGE BASE
// ===============================



export function saveKnowledge(

    telegramId:string,

    filename:string,

    content:string

):void {


    db.prepare(

        `
        INSERT INTO knowledge

        (

            telegram_id,

            filename,

            content

        )

        VALUES (?,?,?)

        `

    )
    .run(

        telegramId,

        filename,

        content

    );


}








export function searchKnowledge(

    telegramId:string,

    keyword:string

){


    return db.prepare(

        `
        SELECT *

        FROM knowledge

        WHERE telegram_id=?

        AND content LIKE ?

        `

    )
    .all(

        telegramId,

        `%${keyword}%`

    );


}