const jwt = require('jsonwebtoken')
const User = require('../models/user')

const auth = async (req, res, next) => {
    try {
    // access the token in header
        const token = req.header('Authorization').replace('Bearer ', '')
    // verify if token is correct using the same secret key for creation of token. secret key is defined in config folder
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // aceess the user with tha particular token
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': token })

        if (!user) {
            // this line catches the catch e line below
            throw new Error()
        }
        req.token = token
        req.user = user
        next()
    } catch (e) {
        res.status(401).send({ error: 'Please authenticate.' })
    }
}

module.exports = auth