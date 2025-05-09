const express = require('express');
const userController = require('./userController');

const app = express();
app.use(express.json());
app.get('/user/:id', userController.getUserProfile);
