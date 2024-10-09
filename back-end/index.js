import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { unzipper } from 'unzipper';
import { v4 as uuidv4 } from 'uuid';
const app = express();
const port = 3000;
app.use(fileUpload());



app.post('/uploadAndValidate', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const file = Object.keys(req.files)[0]

    if (!file.name.endsWith('.zip')) {

        return res.status(400).json({ success: false, message: 'file needs to be zip' });

    }

    const pathName = uuidv4() + '_' + file.name;
    const unZipName = 'Extracted _' + pathName
    const filePath = path.join(__dirname, 'uploads', pathName);
    const UnzipPath = path.join(__dirname, 'unzipped', unZipName);

    if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
        fs.mkdirSync(path.join(__dirname, 'uploads'));
    }

    if (!fs.existsSync(path.join(__dirname, 'unzipped'))) {
        fs.mkdirSync(path.join(__dirname, 'unzipped'));
    }


    file.mv(filePath, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'File Upload Failed! Try Again' });
        }
    });



    fs.createReadStream(filePath)
        .pipe(unzipper.Extract({ path: UnzipPath }))
        .on('close', async () => {

            const dockerfilePath = await FindDockerfile(UnzipPath);

            if (!dockerfilePath) {
                return res.status(500).send('No Dockerfile found!');
            }

            const isDockerValid = await validateDockerfile(dockerfilePath)

            if (!isDockerValid) {

                return res.status(500).send('Docker file is not valid!');

            } else {

                return res.send('Project upzipped successfully!');

            }


        })
        .on('error', () => {
            return res.status(500).send('uzipping failed!');
        })


});





async function FindDockerfile(dir) {

    const files = fs.readdirSync(dir)

    for (let file in files) {

        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const foundDockerfile = await FindDockerfile(fullPath)
            if (foundDockerfile) return foundDockerfile

        } else if (file.name === 'Dockerfile') {
            return fullPath;
        }

        return null;

    }


}

function validateDockerfile(dockerfilePath) {
    return new Promise((resolve, reject) => {
        exec(`hadolint ${dockerfilePath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Dockerfile validation failed: ${stderr}`);
                return resolve(false);
            }
            console.log(`Dockerfile valid: ${stdout}`);
            resolve(true);
        });
    });
}





function loginToGithub() {
    return new Promise((resolve, reject) => {
        const githubUsername = 'your-github-username';
        const githubToken = 'your-github-token';
        exec(`echo "${githubToken}" | docker login ghcr.io -u "${githubUsername}" --password-stdin`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error logging in to GitHub: ${stderr}`);
                return reject(error);
            }
            console.log(`Logged in to GitHub: ${stdout}`);
            resolve();
        });
    });
}

function pushToGithub(imageName, githubRepo) {
    return new Promise((resolve, reject) => {
        const fullImageName = `ghcr.io/${githubRepo}/${imageName}`;
        exec(`docker tag ${imageName} ${fullImageName}`, (error) => {
            if (error) {
                return reject(error);
            }
            exec(`docker push ${fullImageName}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error pushing Docker image to GitHub: ${stderr}`);
                    return reject(error);
                }
                console.log(`Docker image pushed to GitHub: ${stdout}`);
                resolve();
            });
        });
    });
}





app.get('/', (req, res) => {

    res.sendFile()
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
