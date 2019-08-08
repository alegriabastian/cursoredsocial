'use strict'

var express = require('express');
var bodyParser = require('body-parser');

var app = express();

// cargar rutas

// middlewares

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// cors

// rutas

app.get('/', (req, res) => {
    res.status(200).send({
        message:'hola mundo'
    });

});

app.get('/pruebas', (req, res) => {
    res.status(200).send({
        message:'Accion de pruebas en el servidor de nodejs'
    });

});

//exportar
module.exports = app;