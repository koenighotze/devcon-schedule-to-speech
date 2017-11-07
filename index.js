'use strict';

console.log('Loading function');

const aws = require('aws-sdk');

const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const fs = require('fs');

const Polly = new aws.Polly({
    signatureVersion: 'v4',
    region: 'eu-west-1'
});

const storeMp3 = function (title, data) {
    const promise = new Promise( (resolve, reject) => {
        const s3params = {
            Bucket: 'dschmitz',
            Key: 'devcon/speech/' + title + '.mp3',
            ACL: 'public-read',
            Body: data.AudioStream
        };

        console.log('Storing output in ', s3params);
        if (data.AudioStream instanceof Buffer) {
            s3.putObject(s3params, (err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log('Upload success', 'devcon/speech/' + title + '.mp3');
                    resolve(data);
                }
            });
        }
    });

    return promise;
};

const synthesize = function(talk) {
    const promise = new Promise ((resolve, reject) => {
        let params = {
            'Text': talk.summary,
            'OutputFormat': 'mp3',
            'VoiceId': 'Marlene'
        };

        console.log('Synthesizing schedule');
        Polly.synthesizeSpeech(params, (err, data) => {
            if (err) {
                reject(err);
            } else if (data) {
                storeMp3(talk.title, data).then(data => resolve(data)).catch(err => reject(err));
            }
        });
    });

    return promise;
};

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    };

    console.log('Reading s3 object', params);
    s3.getObject(params, (err, data) => {
        if (err) {
            console.log(err);
            const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
            callback(message);
        } else {
            const devcon = JSON.parse(data.Body.toString()).schedule;


            const promisses = devcon.map(talk => synthesize(talk));

            Promise.all(promisses)
            // synthesize(devcon[0])
                .then(res => callback(null, res))
                .catch(err => callback(err));
        }
    });
};
