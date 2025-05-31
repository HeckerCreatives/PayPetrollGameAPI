const { default: mongoose } = require("mongoose")
const Inventory = require("../models/Inventory");
const Trainer = require("../models/Trainer");
const Dailyclaim = require("../models/Dailyclaim");

exports.getgameinventory = async (req, res) => {
    const { id, username } = req.user;

    try {
        const data = await Inventory.find({ owner: new mongoose.Types.ObjectId(id) })
            .sort({ rank: -1 });

        if (!data || data.length === 0) {
            return res.json({ message: "failed", data: "No inventory found" });
        }

        const totalPets = data.length;

        const finaldata = await Promise.all(data.map(async (item, index) => {

            const creaturelimit = (parseInt(item.price) * item.profit) + parseInt(item.price);
            const limitperday = creaturelimit / item.duration;

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
        return res.json({ message: "bad-request", data: "There's a problem getting the inventory. Please contact customer support." });
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

        return res.json({message: "bad-request", data : "There's a problem getting the statistics of total purchased. Please contact customer support."})
    })

    return res.json({message: "success", data: {
        totalaccumulated: unclaimedincome.length > 0 ? unclaimedincome[0].totalaccumulated : 0
    }})
}

exports.updatePet = async (req, res) => {
    const { id, username } = req.user
    const { petid, pts, gametype } = req.body;

    if (pts > 10) {
        return res.json({ message: "failed", data: 'Points cannot exceed 10' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const pet = await Inventory.findOne(
            { _id: new mongoose.Types.ObjectId(petid), owner: new mongoose.Types.ObjectId(id)},
            null,
            { session }
        );

        if (!pet) {
            await session.abortTransaction();
            return res.json({ message: "failed", data: 'Pet not found' });
        }

        if(pet.totalaccumulated >= pet.totalincome){
            await session.abortTransaction();
            return res.json({ message: "failed", data: 'Pet is ready to be claimed!' });
        }

        pet.petlove = Number(pet.petlove) || 0;
        pet.petclean = Number(pet.petclean) || 0;
        pet.petfeed = Number(pet.petfeed) || 0;

        if (gametype === "love") {
            pet.petlove = Math.round(Math.min(pet.petlove + Number(pts), 100));
        } else if (gametype === "clean") {
            pet.petclean = Math.round(Math.min(pet.petclean + Number(pts), 100));
        } else if (gametype === "feed") {
            pet.petfeed = Math.round(Math.min(pet.petfeed + Number(pts), 100));
        }

        await pet.save({ session });
        await session.commitTransaction();

        return res.json({ message: "success" })
    } catch (error) {
        await session.abortTransaction();
        res.json({ message: "bad-request", data: "There's a problem with your account. Please contact support for more details." });
    } finally {
        session.endSession();
    }
};
exports.dailyClaim = async (req, res) => {
    const { id, username } = req.user
    const { petid } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const pet = await Inventory.findOne(
            { _id: new mongoose.Types.ObjectId(petid), owner: new mongoose.Types.ObjectId(id)},
            null,
            { session }
        );

        if (!pet) {
            await session.abortTransaction();
            return res.json({ message: "failed", data: 'Pet not found' });
        }

        if(pet.totalaccumulated >= pet.totalincome){
            await session.abortTransaction();
            return res.json({ message: "failed", data: 'Pet is ready to be claimed!' });
        }

        if(pet.petlove < 100 || pet.petclean < 100 || pet.petfeed < 100) {
            await session.abortTransaction();
            return res.json({ message: "failed", data: 'Pet not ready for daily claim' });
        }

        if (pet.dailyclaim === 1) {
            await session.abortTransaction();
            return res.json({ message: "failed", data: 'Daily claim already made' });
        }

        const creaturelimit = (parseInt(pet.price) * pet.profit) + parseInt(pet.price) + 0.01; // Adding a small value to avoid floating point issues
        const limitperday = creaturelimit / pet.duration;
        pet.dailyclaim = 1;
        pet.totalaccumulated += limitperday;

        await Dailyclaim.create([{
            owner: new mongoose.Types.ObjectId(id),
            inventory: new mongoose.Types.ObjectId(petid),
            amount: limitperday
        }], { session });

        await pet.save({ session });
        await session.commitTransaction();

        return res.json({ message: "success" });
    } catch (error) {
        await session.abortTransaction();
        console.error(error);
        res.json({ message: "bad-request", data: "There's a problem with your account. Please contact support for more details." });
    } finally {
        session.endSession();
    }
};