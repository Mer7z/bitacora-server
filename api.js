const express = require('express');
const multer = require('multer');
// const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const UPLOADS_FOLDER = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_FOLDER)) {
  fs.mkdirSync(UPLOADS_FOLDER, { recursive: true });
  console.log("'uploads' folder created");
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const fileFilter = (req, file, cb) => {
    if (!file) return cb(null, true); // No file uploaded, continue without error

    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        return cb(new Error("Solo se admiten imagenes (jpg, png, gif, webp)."), false);
    }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

async function uploadImage(base64Image, apiKey) {
    const url = "https://freeimage.host/api/1/upload";

    const formData = new URLSearchParams();
    formData.append("key", apiKey);
    formData.append("source", base64Image);
    formData.append("format", "json");

    try {
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const result = await response.json();

        if (result.status_code === 200) {
            console.log("Image uploaded successfully:", result.image.url);
            return { success: true, url: result.image.url };
        } else {
            console.error("Upload failed:", result);
            return { success: false, error: result };
        }
    } catch (error) {
        console.error("Error:", error);
        return { success: false, error: error.message };
    }
}

router.get('/entries', async (req, res) => {
    const res1 = await fetch('https://api.jsonbin.io/v3/b/67eae1db8a456b7966801d34', {
        method: 'GET',
        headers: {
            'X-Master-Key': process.env.JSON_API_KEY,
            'Content-Type': 'application/json'
        }
    });

    const body = await res1.json();

    if (!res1.ok){
        return res.status(500).json({error: "Server error", details: body})
    }

    return res.json(body.record);
})

router.get('/entry/:id', async (req, res) => {
    const res1 = await fetch('https://api.jsonbin.io/v3/b/67eae1db8a456b7966801d34', {
        method: 'GET',
        headers: {
            'X-Master-Key': process.env.JSON_API_KEY,
            'Content-Type': 'application/json'
        }
    });

    const body = await res1.json();

    if (!res1.ok){
        return res.status(500).json({error: "Server error", details: body})
    }
    const entries = body.record.entries
    try {
        return res.json(entries[req.params.id - 1])
    } catch (e) {
        res.status(404).json({ error: "No entry found.", details: error.message });
    }
})

router.post('/entry', upload.single('image'), async (req, res) => {
    //Verify file
    if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
    }
    const { title, text, password } = req.body;

    //Check Password
    if (process.env.PASSWORD != password) {
        return res.status(300).json({ error: "Contraseña Incorrecta." })
    }

    try {
        let uploadResult;
        if (req.file){
            //Upload to Img Hoster
            const imagePath = req.file.path;
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString("base64");
    
            uploadResult = await uploadImage(base64Image, process.env.IMAGE_API_KEY);
    
            //Delete File
            fs.unlinkSync(imagePath);
        }

        if (!req.file || uploadResult.success) {
            const imgUrl = uploadResult ? uploadResult.url : null
            // Saves it to json bin
            const res1 = await fetch('https://api.jsonbin.io/v3/b/67eae1db8a456b7966801d34', {
                method: 'GET',
                headers: {
                    'X-Master-Key': process.env.JSON_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            const body = await res1.json();

            if (!res1.ok){
                return res.status(500).json({error: "Server error", details: body})
            }
            const record = body.record
            console.log(typeof record.entries);
            const object = {
                entries: [...record.entries, {
                    title,
                    text,
                    image: imgUrl
                }]
            }
            console.log(object)
            const res2 = await fetch('https://api.jsonbin.io/v3/b/67eae1db8a456b7966801d34', {
                method: 'PUT',
                body: JSON.stringify(object),
                headers: {
                    'X-Master-Key': process.env.JSON_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            const result = await res2.json();
            if(!res2.ok) {
                return res.status(500).json({error: "Server error", details: result})
            }
            return res.json({message: "Entry Saved Succesfully"})
        } else {
            res.status(400).json({ error: "Upload failed", details: uploadResult.error });
        }
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
})

module.exports = router