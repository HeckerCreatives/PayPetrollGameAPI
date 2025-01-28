const { default: mongoose } = require("mongoose");
const Leaderboard = require("../models/Leaderboard")


// game api
exports.getLeaderboard = async (req, res) => {

    const { id, username } = req.user  


    const top10 = await Leaderboard.find({})
    .populate('owner')
    .sort({ amount: -1 })
    .limit(10)
    .then(data => data)
    .catch(err => {
        console.log(`There's a problem getting the leaderboard for ${username}. Error ${err}`);
        return res.status(400).json({ message: "bad-request", data: "There's a problem getting the leaderboard. Please contact customer support." });
    })

    const user = await Leaderboard.findOne({ owner:  new mongoose.Types.ObjectId(id) })

    if (!user){
        return res.status(404).json({ message: "failed", data: "No leaderboard found" });
    }

    const userRank = await Leaderboard.countDocuments({ amount: { $gt: user.amount } })

    const finaldata = {
        topplayers: [],
        user: {
            rank: userRank + 1,
            amount: user.amount
        }
    }

    top10.map((item, index) => {
        finaldata.topplayers.push({
            rank: index + 1,
            player_name: item.owner.username,
            player_score: item.amount
        })
    })

    return res.json({ message: "success", data: finaldata});
}

exports.sendeventpoints = async (req, res) => {
    const { id, username } = req.user
    const { pts } = req.body

    if (!pts || isNaN(pts) || pts < 0){
        return res.status(400).json({ message: "bad-request", data: "Invalid amount" });
    }

    const user = await Leaderboard.findOne({ owner: new mongoose.Types.ObjectId(id) })

    if (!user){
        return res.status(404).json({ message: "failed", data: "No leaderboard found" });
    }

    user.amount += pts
    await user.save()

    return res.json({ message: "success" });  
}