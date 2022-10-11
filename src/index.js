// first install express then req. helps to run server
const express = require('express')
const multer = require('multer')
const sharp = require('sharp')
// req mongoose
require('./db/mongoose')
const User = require('./models/user')
const Task = require('./models/task')
// this authentication is not required for login and signup
const auth = require('./middleware/auth')
// const { sendWelcomeEmail, sendCancelationEmail } = require('../emails/account')

const app = express()
// run on heroku port or on port3000. port is defined in config folder
const port = process.env.PORT

// helps to parse json requests which usually comes from postman and converts to objects that can be sent to handlers
app.use(express.json())

// create handlers. post http req is used because data is being created
app.post('/users', async (req, res) => {
    const user = new User(req.body)
// save new user and catch error. New user can be created here on body/text to json/then send on postman. insert localhosturl
    try {
        await user.save()
        // use to send email after signup. commented because not yet set up
        // sendWelcomeEmail(user.email, user.name)
        // generate token after sign up
        const token = await user.generateAuthToken()
        res.status(201).send({ user, token })
    } catch (e) {
        res.status(400).send(e)
    }
})

// creating route for login using defined findbycred func defined in model
app.post('/users/login', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password)
        // func created in model
        const token = await user.generateAuthToken()
        res.send({ user, token })
    } catch (e) {
        res.status(400).send()
    }
})

// logout of only one device i.e logging out one token. auth is required to logout so add to route handler
app.post('/users/logout', auth, async (req, res) => {
    try {
        // filter the token of that device from all tokens on various devices
        req.user.tokens = req.user.tokens.filter((token) => {
            // bypass all other tokens
            return token.token !== req.token
        })
        // logout filteres token
        await req.user.save()
        
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

// logout from all devices
app.post('/users/logoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = []
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

app.get('/users/me', auth, async (req, res) => {
    res.send(req.user)
})

// access your profile. authentication is required to access this route
// get data by id
// update user profile by id. authentication is required and requser can be accessed from the func in auth file
app.patch('/users/me', auth, async (req, res) => {
    // equate the requested update to a var updates
    const updates = Object.keys(req.body)
    // the only things allowed to be updated. id cannot be updated
    const allowedUpdates = ['name', 'email', 'password', 'age']
    // define a func
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }
    try {
        updates.forEach((update) => req.user[update] = req.body[update])
        await req.user.save()
        // send updated info to user
        res.send(req.user)
    } catch (e) {
        res.status(400).send(e)
    }
})

// delete a user
app.delete('/users/me', auth, async (req, res) => {
    try {
        await req.user.remove()
         // use to send email after deleting profile. commented because not yet set u
        // sendCancelationEmail(req.user.email, req.user.name)
        res.send(req.user)
    } catch (e) {
        res.status(500).send()
    }
})

// image settings
const upload = multer({
    limits: {
        // file must be less than or equal to 1mb
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        // accepted files. 
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an image'))
        }
// callback with no error
        cb(undefined, true)
    }
    
})

// create/update profile picture. name in single brac will be the key in postman
app.post('/users/me/avatar', auth, upload.single('avatar'), async (req, res) => {
    // use sharp to resize and convert images. image uploades is stores under reqfilebuffer
    const buffer = await sharp(req.file.buffer).resize({ width: 250, height: 250 }).png().toBuffer()
    // save image under avatar in user model
    req.user.avatar = buffer
    await req.user.save()
    res.send()
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message })
})

// deleting profile picture
app.delete('/users/me/avatar', auth, async (req, res) => {
    // wipe profile picture
    req.user.avatar = undefined
    await req.user.save()
    res.send()
})

// read profile picture by id
app.get('/users/:id/avatar', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)

        if (!user || !user.avatar) {
            throw new Error()
        }

        res.set('Content-Type', 'image/png')
        res.send(user.avatar)
    } catch (e) {
        res.status(404).send()
    }
})

// TASKS
// post a task. user has been authenticated hence access to requser
app.post('/tasks', auth, async (req, res) => {
    const task = new Task({
        ...req.body,
        // ensures only the user can post a task to their page
        owner: req.user._id
    })

    try {
        await task.save()
        res.status(201).send(task)
    } catch (e) {
        res.status(400).send(e)
    }
})

// access all tasks posted by a particular user. ways to use route in postman
// GET /tasks?completed=true
// GET /tasks?limit=10&skip=20
// GET /tasks?sortBy=createdAt:desc
app.get('/tasks', auth, async (req, res) => {
    const match = {}
    const sort = {}
// to  set up completed route
    if (req.query.completed) {
        match.completed = req.query.completed === 'true'
    }

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1
    }
    try {
        // find tasks by user
        await req.user.populate({
            path: 'tasks',
            match,
            options: {
                // how many tasks shows up at once, can specify a number if user shouldnt input
                limit: parseInt(req.query.limit),
                // how many to skip. skip 3 out of 5, the next 2 will show
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate()
        res.send(req.user.tasks)
    } catch (e) {
        res.status(500).send()
    }
})

// access one task by id
app.get('/tasks/:id', auth, async (req, res) => {
    const _id = req.params.id
    try {
        const task = await Task.findOne({ _id, owner: req.user._id })

        if (!task) {
            return res.status(404).send()
        }

        res.send(task)
    } catch (e) {
        res.status(500).send()
    }
})

app.patch('/tasks/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['description', 'completed']
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }

    try {
        const task = await Task.findOne({ _id: req.params.id, owner: req.user._id})

        if (!task) {
            return res.status(404).send()
        }

        updates.forEach((update) => task[update] = req.body[update])
        await task.save()
        res.send(task)
    } catch (e) {
        res.status(400).send(e)
    }
})


app.delete('/tasks/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id })

        if (!task) {
            res.status(404).send()
        }

        res.send(task)
    } catch (e) {
        res.status(500).send()
    }
})

app.listen(port, () => {
    console.log('Server is up on port ' + port)
})

