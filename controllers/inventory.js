const { default: mongoose } = require("mongoose")
const Inventory = require("../models/Inventory");
const Trainer = require("../models/Trainer");

exports.getgameinventory = async (req, res) => {
    const { id, username } = req.user;

    try {
        const data = await Inventory.find({ owner: new mongoose.Types.ObjectId(id) })
            .sort({ rank: -1 });

        if (!data || data.length === 0) {
            return res.status(404).json({ message: "failed", data: "No inventory found" });
        }

        const totalPets = data.length;

        const finaldata = await Promise.all(data.map(async (item, index) => {
            const trainerz = await Trainer.findOne({ name: item.type });

            if (!trainerz) {
                console.log(`Trainer type ${item.type} not found for ${username}`);
                return null; // Skip if no trainer details found
            }

            const creaturelimit = (parseInt(item.price) * trainerz.profit) + parseInt(item.price);
            const limitperday = creaturelimit / trainerz.duration;

            return {
                petnumber: index + 1,
                petid: item._id,
                petrank: item.rank,
                petname: item.petname,
                petlove: item.petlove,
                petclean: item.petclean,
                petfeed: item.petfeed,
                dailyclaim: item.dailyclaim,
                totalaccumulated: item.totalaccumulated,
                totalincome: item.totalincome,
                limittotal: creaturelimit,
                limitdaily: limitperday
            };
        }));

        const formattedData = finaldata.filter(item => item !== null).reduce((acc, item) => {
            acc[item.petnumber] = item;
            return acc;
        }, {});

        return res.json({ message: "success", totalPets, data: formattedData });
    } catch (err) {
        console.log(`There's a problem getting the inventory for ${username}. Error ${err}`);
        return res.status(400).json({ message: "bad-request", data: "There's a problem getting the inventory. Please contact customer support." });
    }
};
exports.getunclaimedincomeinventory = async (req, res) => {
    const {id, username} = req.user

    const unclaimedincome = await Inventory.aggregate([
        { 
            $match: { 
                owner: new mongoose.Types.ObjectId(id)
            } 
        },
        { 
            $group: { 
                _id: null, 
                totalaccumulated: { $sum: "$totalaccumulated" }
            } 
        }
    ])
    .catch(err => {
        console.log(`There's a problem getting the statistics of total purchase for ${username}. Error ${err}`)

        return res.status(400).json({message: "bad-request", data : "There's a problem getting the statistics of total purchased. Please contact customer support."})
    })

    return res.json({message: "success", data: {
        totalaccumulated: unclaimedincome.length > 0 ? unclaimedincome[0].totalaccumulated : 0
    }})
}

exports.updatePet = async (req, res) => {
    const { id, username } = req.user
    const { petid, pts, gametype } = req.body;

    if (pts > 10) {
        return res.status(400).json({ message: "failed", data: 'Points cannot exceed 10' });
    }

    try {
        const pet = await Inventory.findOne({ _id: new mongoose.Types.ObjectId(petid), owner: new mongoose.Types.ObjectId(id)});
        if (!pet) {
            return res.status(404).json({ message: "failed", data: 'Pet not found' });
        }

        pet.petlove = Number(pet.petlove) || 0;
        pet.petclean = Number(pet.petclean) || 0;
        pet.petfeed = Number(pet.petfeed) || 0;

        if (gametype === "love") {
            pet.petlove = Math.min(pet.petlove + Number(pts), 100);
        } else if (gametype === "clean") {
            pet.petclean = Math.min(pet.petclean + Number(pts), 100);
        } else if (gametype === "feed") {
            pet.petfeed = Math.min(pet.petfeed + Number(pts), 100);
        }

        await pet.save();

        return res.status(200).json({ message: "success" })
    } catch (error) {
        res.status(500).json({ message: "bad-request", data: "There's a problem with your account. Please contact support for more details." });
    }
};

exports.dailyClaim = async (req, res) => {

    const { id, username } = req.user
    const { petid } = req.body;

    try {
        const pet = await Inventory.findOne({ _id: new mongoose.Types.ObjectId(petid), owner: new mongoose.Types.ObjectId(id)});
        if (!pet) {
            return res.status(404).json({ message: "failed", data: 'Pet not found' });
        }

        if(pet.petlove < 100 || pet.petclean < 100 || pet.petfeed < 100) {
            return res.status(400).json({ message: "failed", data: 'Pet not ready for daily claim' });
        }

        if (pet.dailyclaim === 1) {
            return res.status(400).json({ message: "failed", data: 'Daily claim already made' });
        }

        const trainerz = await Trainer.findOne({ name: pet.type })
        .then(data => data)
        .catch(err => {
            console.log(`Trainer type ${pet.type} not found for ${username}. Error: ${err}`);
            return null;
        });

        const creaturelimit = (parseInt(pet.price) * trainerz.profit) + parseInt(pet.price);
        const limitperday = creaturelimit / trainerz.duration;
        pet.dailyclaim = 1;
        pet.totalaccumulated += limitperday;

        await pet.save();

        return res.status(200).json({ message: "success" });
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "bad-request", data: "There's a problem with your account. Please contact support for more details." });
    }
};