'use strict'

const server = 'localhost:27017'; 
const database = 'cursoredsocial';   

const mongoose = require('mongoose');
var app = require('./app');
var port = 3801;

// conexion db
mongoose.Promise = global.Promise;
mongoose.connect(`mongodb://${server}/${database}`, { useNewUrlParser: true })
    .then(()=>{
        console.log("la conexion la cursoredsocial se ha realizado");
        // crear servidor
        app.listen(port, () =>{ 
            console.log(`servidor corriendo en http://${server}:${port}`);
        });
    })
    .catch (err => {
        console.error('Database connection error' + err)
      });
