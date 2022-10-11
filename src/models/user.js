// create model for users
const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Task = require('./task')

const userSchema = new mongoose.Schema({
    name: {
        // use custom validators on mongoose but it doesnt have a lot
        type: String,
        required: true,
        // removes space input by user and saves
        trim: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        // converts any uppercase input by user and saves
        lowercase: true,
        // install validator and use its email feature to identify non emails
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error('Email is invalid')
            }
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 7,
        trim: true,
        validate(value) {
            // id you dont include ltolowecase, no errow will be found if a letter is in caps
            if (value.toLowerCase().includes('password')) {
                throw new Error('Password cannot contain "password"')
            }
        }
    },
    age: {
        type: Number,
        default: 0,
        validate(value) {
            if (value < 0) {
                throw new Error('Age must be a postive number')
            }
        }
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }],
    avatar: {
        type: Buffer
    }
},{
    // schema enables us to use timestamp which attaches date created and date updated
    timestamps: true
})
// connect task and users. connect the ownerfield in tasks to the id of user
userSchema.virtual('tasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'owner'
})


// prevent ressend from sending password and token along with other user info
// another way to do this is create a userschema func method here and call in index file; only replace tojson with func name
userSchema.methods.toJSON = function () {
    const user = this
    const userObject = user.toObject()

    delete userObject.password
    delete userObject.tokens
    delete userObject.avatar

    return userObject
}

// create func to gen token
userSchema.methods.generateAuthToken = async function () {
    const user = this
    // generate token. vars are id and a secret key. secret key is defined config folder
    const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET)

    // concatenate and save token to database. when a user signs up or logins a token prints with user info
    user.tokens = user.tokens.concat({ token })
    await user.save()

    return token
}

// for login
userSchema.statics.findByCredentials = async (email, password) => {
    const user = await User.findOne({ email })
// for email not in database
    if (!user) {
        throw new Error('Unable to login')
    }
// for email in database compare pasword
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
        throw new Error('Unable to login')
    }

    return user
}

// Hash the plain text password before saving
userSchema.pre('save', async function (next) {
    const user = this

    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }
    next()
})

// Delete user tasks when user is removed
userSchema.pre('remove', async function (next) {
    const user = this
    // delete all tasks under that userid
    await Task.deleteMany({ owner: user._id })
    next()
})

// create db user. but db in studio converts to lowercase and adds s
const User = mongoose.model('User', userSchema)
// export model
module.exports = User
