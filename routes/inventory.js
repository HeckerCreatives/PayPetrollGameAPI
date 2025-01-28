const { getunclaimedincomeinventory, getgameinventory, updatePet, dailyClaim } = require("../controllers/inventory")
const { protectplayer } = require("../middleware/middleware")

const router = require("express").Router()


router 
.get("/getunclaimedincomeinventory", protectplayer, getunclaimedincomeinventory)
.get("/getgameinventory", protectplayer, getgameinventory)
.post("/updatepet", protectplayer, updatePet)
.post("/dailyclaim", protectplayer, dailyClaim)

module.exports = router