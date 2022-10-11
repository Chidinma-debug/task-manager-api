const mongoose = require('mongoose')

// create database that reflects in studio 3t named taskmanagerapi and connect to mongoose
// environmenrt is defined in config folder
mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
})

