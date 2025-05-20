const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const config = require(__dirname + '/config_bulk.js');
const nodemailer = require('nodemailer');
const cors = require('cors');

const prettyjson = require('prettyjson');

const axios = require('axios');
const config_m = require('./config_m');
const m_url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const consumer_key = config_m.consumerKey;
const consumer_secret = config_m.secret;
const passkey = config_m.passkey;
const shortcode = config_m.shortcode;

const auth = "Basic " + Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

let oauth_token;


router.use(cors())
// Use body parser to parse JSON body
router.use(bodyParser.json());
const connAttrs = mysql.createConnection(config.connection);
options = {
    apiKey: '6b96c2bd3c8d1f782db79ec687b927fabfe9ecec6b830dfe777189ba32224f8a',         // use your sandbox app API key for development in the test environment
    username: 'danielOpiyo',      // use 'sandbox' for development in the test environment
}
const africasTalking = require('africastalking')(options);
// Initialize a service e.g. SMS
sms = africasTalking.SMS

// Use the service
router.post('/sendSMS', function (req, res) {
    var dataTosend = {
        to: req.body.to,
        // message: `Dear ${req.body.fname}, ${req.body.message} #${req.body.cname}`
        message: `${req.body.message} #${req.body.cname}`
    }

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        console.log('You are Here');
        var toDb = {
            template_message: req.body.message,
            group_id: req.body.groupId,
            org_id: decoded.org_id,
            created_by: decoded.entity_id,
            balance_before: req.body.balance
        }
        console.log(toDb);
        sms.send(dataTosend)
            .then(response => {
                console.log(response);
                // console.log(`+++++++++++++++++++++++++++++++++EveryThing works well @ zyptech computers++++++++++++++++++++++++++++++++++++++`)

                var i;
                for (i = 0; i < response.SMSMessageData.Recipients.length; i++) {
                    connAttrs.query("INSERT INTO b_sms SET ? ", {
                        template_message: toDb.template_message,
                        group_id: toDb.group_id,
                        contact: response.SMSMessageData.Recipients[i].number,
                        sms_status: response.SMSMessageData.Recipients[i].status,
                        org_id: toDb.org_id,
                        // balance_before: toDb.balance_before,
                        // balance_after: (toDb.balance_before - 2),
                        created_by: toDb.created_by
                    }, function (error, results) {
                        if (error) {
                            console.log(error);
                        } else {
                            // console.log(`${decoded.role}: ${decoded.username}, succesfully added Item: ${items.name} on ${new Date()}`);
                            // return res.contentType('application/json').status(201).send(JSON.stringify(results));
                            console.log(results);
                        }
                    })

                }
                return res.contentType('application/json').status(201).send(JSON.stringify(response));
            })
            .catch(error => {
                console.log(error);
            });
    });
});

// login
router.post('/signin', function (req, res) {

    let user1 = {
        email: req.body.email,
        password: req.body.password
    }
    if (!user1) {
        return res.status(400).send({
            error: true,
            message: 'Please provide login details'
        });
    }
    connAttrs.query("SELECT * FROM vw_user_login where email=? AND DATEDIFF(org_dade_date, curdate()) > 0", user1.email, function (error, result) {
        if (error || result < 1) {
            res.set('Content-Type', 'application/json');
            var status = error ? 500 : 404;
            res.status(status).send(JSON.stringify({
                status: status,
                message: error ? "Error getting the that email" : "Invalid Credentials.Please try again or Contact systemadmin",
                detailed_message: error ? error.message : ""
            }));
            console.log('========= You have Got an error ================ for this User: ' + user1.email);
            return (error);
        } else {
            user = result[0];


            bcrypt.compare(req.body.password, user.password, function (error, pwMatch) {
                var payload;
                if (error) {
                    return (error);
                }
                if (!pwMatch) {
                    res.status(401).send({
                        message: 'Wrong Password. please Try Again .'
                    });
                    return;
                }
                payload = {
                    email: user.email,
                    org_id: user.org_id,
                    entity_id: user.user_id,
                    org: user.org_name,
                    contact: user.org_contact,
                    close_date: user.org_dade_date,
                    balance: user.point_balance
                };

                res.status(200).json({
                    user: {
                        email: user.email,
                        entityId: user.user_id,
                        org: user.org_name,
                        account: user.org_id,
                        contact: user.org_contact,
                        closeDate: user.org_dade_date,
                        balance: user.point_balance,
                        type: user.type
                    },
                    token: jwt.sign(payload, config.jwtSecretKey, {
                        expiresIn: 60 * 60 * 24
                    }) //EXPIRES IN ONE DAY,
                });
            });
        }

    });

});


// adding New Group
router.post('/newGroup', function (req, res) {
    var group = {
        name: req.body.name
    }
    // token
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        connAttrs.query('SELECT * FROM b_group where group_name=?', group.name, function (error, result) {
            if (error || result.length > 0) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "Group you have entered is already Captured.",
                    detailed_message: error ? error.message : `Please Use a different group a part from this ${group.name}`
                }));
                console.log("error occored");
                return (error);
            }
            connAttrs.query("INSERT INTO b_group SET ? ", {
                group_name: group.name,
                org_id: decoded.org_id,
                created_by: decoded.entity_id
            }, function (error, results) {
                if (error) {
                    res.set('Content-Type', 'application/json');
                    res.status(500).send(JSON.stringify({
                        status: 500,
                        message: "Error Posting new Group",
                        detailed_message: error.message
                    }));
                } else {
                    // console.log(`${decoded.role}: ${decoded.username}, succesfully added Item: ${items.name} on ${new Date()}`);
                    return res.contentType('application/json').status(201).send(JSON.stringify(results));
                }
            })
        });

    });
});


// pulling existing contact for a particular Groups
router.post('/allContactsGroup', function (req, res) {

    var contact = {
        id: req.body.id
    }
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM vw_all_contacts WHERE group_id=? AND org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, [contact.id, decoded.org_id], function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Contacts found",
                    detailed_message: error ? error.message : "Sorry there are no Contacts for that Gropu set."
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
            // console.log(`categories selection Released succesfullly by ${decoded.username} on ${new Date()}`);
        });
    });
});

// pulling existing Groups
router.post('/allGroups', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM b_group WHERE org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Groups found",
                    detailed_message: error ? error.message : "Sorry there are no Groups set. Please set Groups first"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
            // console.log(`categories selection Released succesfullly by ${decoded.username} on ${new Date()}`);
        });
    });
});


// adding New Contact
router.post('/newContact', function (req, res) {
    var contact = {
        name: req.body.name,
        group_id: req.body.group_id,
        contact: req.body.contact
    }
    // token
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }

        connAttrs.query('SELECT * FROM b_contact where contact=?', contact.contact, function (error, result) {
            if (error || result.length > 0) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "Contact you have entered is already taken.",
                    detailed_message: error ? error.message : `If user with this ${contact.contact} is nolonger with you please remove his details from the system`
                }));
                console.log("error occured");
                return (error);
            }
            connAttrs.query("INSERT INTO b_contact SET ? ", {
                contact: contact.contact,
                name: contact.name,
                group_id: contact.group_id,
                org_id: decoded.org_id,
                created_by: decoded.entity_id
            }, function (error, results) {
                if (error) {
                    res.set('Content-Type', 'application/json');
                    res.status(500).send(JSON.stringify({
                        status: 500,
                        message: "Error Posting new Contact",
                        detailed_message: error.message
                    }));
                } else {
                    // console.log(`${decoded.role}: ${decoded.username}, succesfully added Item: ${items.name} on ${new Date()}`);
                    return res.contentType('application/json').status(201).send(JSON.stringify(results));
                }
            })
        });

    });
});


// pulling existing contacts
router.post('/allContacts', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM vw_all_contacts WHERE org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Contact found",
                    detailed_message: error ? error.message : "Sorry there are no Contacts set. Please set Contacts first"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
            // console.log(`categories selection Released succesfullly by ${decoded.username} on ${new Date()}`);
        });
    });
});


// pulling existing contacts for the groups fro sending sms
router.post('/contactsGroup', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM vw_group_contact WHERE org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Contacts found",
                    detailed_message: error ? error.message : "Sorry there are no Contacts set. Please set first"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
            // console.log(`categories selection Released succesfullly by ${decoded.username} on ${new Date()}`);
        });
    });
});


// adding New SMS Template
router.post('/newTemplates', function (req, res) {
    var template = {
        template_name: req.body.template_name,
        template_description: req.body.description,
    }
    // token
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        connAttrs.query("INSERT INTO b_template SET ? ", {
            template_name: template.template_name,
            template_description: template.template_description,
            org_id: decoded.org_id,
            created_by: decoded.entity_id
        }, function (error, results) {
            if (error) {
                res.set('Content-Type', 'application/json');
                res.status(500).send(JSON.stringify({
                    status: 500,
                    message: "Error Posting Template",
                    detailed_message: error.message
                }));
            } else {
                // console.log(`${decoded.role}: ${decoded.username}, succesfully added Item: ${items.name} on ${new Date()}`);
                return res.contentType('application/json').status(201).send(JSON.stringify(results));
            }
        })

    });
});

// pulling existing Templates
router.post('/allTemplates', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM b_template WHERE org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No SMS template found",
                    detailed_message: error ? error.message : "Sorry there are no Templates set. Please set first"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
            // console.log(`categories selection Released succesfullly by ${decoded.username} on ${new Date()}`);
        });
    });
});




// adding New SMS schedule
router.post('/newSchedule', function (req, res) {
    var schedule = {
        schedule_time: req.body.time,
        group_id: req.body.group_id,
        template_id: req.body.template_id
    }
    // token
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        connAttrs.query("INSERT INTO b_schedule SET ? ", {
            template_id: schedule.template_id,
            schedule_time: schedule.schedule_time,
            group_id: schedule.group_id,
            org_id: decoded.org_id,
            created_by: decoded.entity_id
        }, function (error, results) {
            if (error) {
                res.set('Content-Type', 'application/json');
                res.status(500).send(JSON.stringify({
                    status: 500,
                    message: "Error Creating Schedule",
                    detailed_message: error.message
                }));
            } else {
                // console.log(`${decoded.role}: ${decoded.username}, succesfully added Item: ${items.name} on ${new Date()}`);
                return res.contentType('application/json').status(201).send(JSON.stringify(results));
            }
        })

    });
});



// pulling existing SMS Reports
router.post('/allReports', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM vw_all_sms_general WHERE org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No SMS sent found",
                    detailed_message: error ? error.message : "Sorry there are no sms"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
            // console.log(`categories selection Released succesfullly by ${decoded.username} on ${new Date()}`);
        });
    });
});


// pulling existing Deliverd SMS Reports
router.post('/allDeliveredSms', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM vw_all_sms_general WHERE sms_status = 'Success' AND org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Delivered SMS sent found",
                    detailed_message: error ? error.message : "Sorry there are no delivered sms"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
        });
    });
});


// pulling existing Failed SMS Reports
router.post('/allFailedSms', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT * FROM vw_all_sms_general WHERE sms_status != 'Success' AND org_id=? AND deleted_yn='N'";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Delivered SMS sent found",
                    detailed_message: error ? error.message : "Sorry there are no delivered sms"
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
        });
    });
});



// reset User Password
router.post('/resetPassword', function post(req, res, next) { // 

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var unhashedPassword = req.body.password;
        connAttrs.query("SELECT password FROM vw_user_login where email=? AND org_id=?", [decoded.email, decoded.org_id], function (error, result) {
            if (error || result < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the that User" : "Invalid Credentials.Please try again or Contact systemadmin",
                    detailed_message: error ? error.message : ""
                }));
                console.log(`Error when user ${decoded.email} resetting password`);
                return (error);
            } else {
                user = result[0];


                bcrypt.compare(req.body.oldPassword, user.password, function (error, pwMatch) {

                    if (error) {
                        return (error);
                    }
                    if (!pwMatch) {
                        res.status(401).send({
                            message: 'Wrong Old Password. please Try Again .'
                        });
                        return;
                    }

                    bcrypt.genSalt(10, function (err, salt) {
                        if (err) {
                            return next(err);
                        }
                        bcrypt.hash(unhashedPassword, salt, null, function (err, hash) {
                            if (err) {
                                return next(err);
                            }

                            connAttrs.query("UPDATE b_users SET user_password=? WHERE user_id=? ", [hash, decoded.entity_id], function (error, results) {
                                if (error) {
                                    res.set('Content-Type', 'application/json');
                                    res.status(500).send(JSON.stringify({
                                        status: 500,
                                        message: "Error Resetting the password",
                                        detailed_message: error.message
                                    }));
                                } else {
                                    // console.log(`${user.role}: ${user.username}, succesfully added by: ${user.created_by} on ${new Date()}`);
                                    return res.contentType('application/json').status(201).send(JSON.stringify(results));
                                }
                            })
                        })
                    })
                })
            }
        })
    })
});


// for graphs
// pulling all sms reports for A day for chart view
router.post('/dailySmsChartReport', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT sms_status as name, COUNT(sms_status) as value FROM b_sms WHERE DATE_FORMAT(created_at, '%Y-%m-%d')=CURDATE() AND org_id=? GROUP BY sms_status";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Records found for daily chart",
                    detailed_message: error ? error.message : "Sorry there are no Records Found for daily chart."
                }));
                return (error);
            }


            res.contentType('application/json').status(200).send(JSON.stringify(results));
        });
    });
});


// for graphs
// pulling all sms reports for A week for chart view
router.post('/weeklySmsChartReport', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT sms_status as name, COUNT(sms_status) as value FROM b_sms WHERE created_at <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_at >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) AND org_id=? GROUP BY sms_status";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Records found for Weekly chart",
                    detailed_message: error ? error.message : "Sorry there are no Records Found for weekly chart."
                }));
                return (error);
            }


            res.contentType('application/json').status(200).send(JSON.stringify(results));
        });
    });
});


// for graphs
// pulling all sms reports for A Month for chart view
router.post('/monthlySmsChartReport', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT sms_status as name, COUNT(sms_status) as value FROM b_sms WHERE created_at <= LAST_DAY(curdate()) AND created_at >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) AND org_id=? GROUP BY sms_status";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Records found for Monthly chart",
                    detailed_message: error ? error.message : "Sorry there are no Records Found for Monthly chart."
                }));
                return (error);
            }


            res.contentType('application/json').status(200).send(JSON.stringify(results));
        });
    });
});


// checking Points before sms sending
router.post('/checkPoints', function (req, res) {

    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        var sql = "SELECT point_balance FROM b_org WHERE org_id=?";
        connAttrs.query(sql, decoded.org_id, function (error, results) {
            if (error || results.length < 1) {
                res.set('Content-Type', 'application/json');
                var status = error ? 500 : 404;
                res.status(status).send(JSON.stringify({
                    status: status,
                    message: error ? "Error getting the server" : "No Data found",
                    detailed_message: error ? error.message : "Sorry there are no data for that organisation."
                }));
                return (error);
            }

            res.contentType('application/json').status(200).send(JSON.stringify(results));
        });
    });
});



// // Update Contact
router.post('/updateContact', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let itemToUpdate = {
                contact_id: req.body.id,
                contact: req.body.contact,
                name: req.body.name,
                group_id: req.body.groupId,
                updated_by: decoded.entity_id,
                updated_at: new Date()

            }

            if (!itemToUpdate) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_contact SET name=?, contact=?, group_id=?, updated_at = ?, updated_by=? WHERE contact_id=? AND org_id=?"
            connAttrs.query(sql, [itemToUpdate.name, itemToUpdate.contact, itemToUpdate.group_id,
            itemToUpdate.updated_at, itemToUpdate.updated_by, itemToUpdate.contact_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Updating Contact",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/update Released=========================")

        }
    })
});


// // Update Group
router.post('/updateGroup', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let groupToUpdate = {
                group_name: req.body.name,
                group_id: req.body.id,
                updated_by: decoded.entity_id,
                updated_at: new Date()

            }

            if (!groupToUpdate) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_group SET group_name=?, updated_at= ?, updated_by=? WHERE group_id=? AND org_id=?"
            connAttrs.query(sql, [groupToUpdate.group_name, groupToUpdate.updated_at,
            groupToUpdate.updated_by, groupToUpdate.group_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Updating Group",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/update Released=========================")

        }
    })
});


// // Update Template
router.post('/updateTemplate', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let templateToUpdate = {
                template_id: req.body.id,
                template_name: req.body.templateName,
                template_description: req.body.description,
                // template_status: req.body.template_status,
                updated_by: decoded.entity_id,
                updated_at: new Date()

            }

            if (!templateToUpdate) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_template SET template_name=?, template_description=?, updated_at = ?, updated_by=? WHERE template_id=? AND org_id=?"
            connAttrs.query(sql, [templateToUpdate.template_name, templateToUpdate.template_description,
            templateToUpdate.updated_at, templateToUpdate.updated_by, templateToUpdate.template_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Updating Template",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/update Released=========================")

        }
    })
});



// delete group
router.post('/deleteGroup', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let groupTodelete = {
                group_id: req.body.id,
                deleted_by: decoded.entity_id,
                deleted_at: new Date()
            }

            if (!groupTodelete) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_group SET deleted_yn = 'Y', deleted_by=?, deleted_at=? WHERE group_id=? AND org_id=?"
            connAttrs.query(sql, [groupTodelete.deleted_by, groupTodelete.deleted_at, groupTodelete.group_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Deleteing your Group",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/CategoryDelete Released=========================")

        }
    })
})



// delete Contact
router.post('/deleteContact', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let contactTodelete = {
                contact_id: req.body.id,
                deleted_by: decoded.entity_id,
                deleted_at: new Date()

            }

            if (!contactTodelete) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_contact SET deleted_yn='Y', deleted_by=?, deleted_at=? WHERE contact_id=? AND org_id=?"
            connAttrs.query(sql, [contactTodelete.deleted_by, contactTodelete.deleted_at, contactTodelete.contact_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Deleteing your Contact",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/CategoryDelete Released=========================")

        }
    })
})


// delete Template
router.post('/deleteTemplate', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let templateTodelete = {
                template_id: req.body.id,
                deleted_by: decoded.entity_id,
                deleted_at: new Date()

            }

            if (!templateTodelete) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_template SET deleted_yn=?, deleted_by=?, deleted_at=? WHERE template_id=? AND org_id=?"
            connAttrs.query(sql, ['Y', templateTodelete.deleted_by, templateTodelete.deleted_at, templateTodelete.template_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Deleteing your Template",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/CategoryDelete Released=========================")

        }
    })
})


// Removing contact from a group
router.post('/removeContact', function (req, res) {
    var token = req.body.token;
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        } else {
            let contactToRemove = {
                contact_id: req.body.id

            }

            if (!contactToRemove) {
                return res.status(400).send({
                    error: true,
                    message: 'Please provide details to send'
                });
            }
            let sql = "UPDATE b_contact SET group_id=? WHERE contact_id=? AND org_id=?"
            connAttrs.query(sql, [0, contactToRemove.contact_id, decoded.org_id],
                function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        res.status(500).send(JSON.stringify({
                            status: 500,
                            message: "Error Removing that Contact",
                            detailed_message: error.message
                        }));
                    } else {
                        return res.contentType('application/json').status(201).send(JSON.stringify(results));
                    }
                })

            // console.log("=========================================Post:/CategoryDelete Released=========================")

        }
    })
})


// sending mail to admin when stock go low
router.post('/sendMail', function (req, res) {

    var token = req.body.token;
    var dataToMail = {
        id: req.body.id,
        itemName: req.body.itemName,
        category: req.body.category,
        quantity: req.body.quantity,
        buying_price: req.body.buying_price,
        price: req.body.price,
        checkedIn_date: req.body.checkedIn_date,
        valueOfItems: req.body.valueOfItems,
        totalSold: req.body.totalSold,
        checkedIn_quantity: req.body.checkedIn_quantity,
        expected_total_sale: req.body.expected_total_sale,
        email: req.body.email,
        username: req.body.username
    }
    if (!token) return res.status(401).send({
        auth: false,
        message: 'No token provided.'
    });

    jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
        if (err) {
            return res.status(500).send({
                auth: false,
                message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
            });
        }
        //  mail
        var mailSender = 'notification@zyptech.co.ke';

        var mail = nodemailer.createTransport({
            host: 'mail.zyptech.co.ke',
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: mailSender,
                pass: 'zyptechUpdate@2020?'
            }
        });

        var mailOptions = {
            from: mailSender,
            to: dataToMail.email,
            subject: `${dataToMail.itemName} Runing Out of stock`,
            html: `<div style="border-color: #337ab7; border-radius:6px; border: 0px solid #337ab7;">
            <div style=" padding: 5px 5px; border-bottom: 1px solid transparent; border-top-left-radius: 3px;
             border-top-right-radius: 3px; color: #fff; background-color: #337ab7; border-color: #337ab7;">
         <h2 style="color:black"><img src="https://zyptech.co.ke/logo.png"></h2>
         </div>
         <h3>Dear ${dataToMail.username},</h3>
         <p>${dataToMail.itemName}, is running out of stock, please consinder restocking it.</p>
         <p>Below is a breakdown on how it was sold</p>
         <table style="width:100%;  border-collapse: collapse;">
                    <tr style="background-color: black; color: white">
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Product</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Buying Price</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Selling Price</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Current Stock</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Stock Added</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Last Stocked</th>                        
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Amount Sold</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Expected Sale</th>
                        <th style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">Worth InStore</th>                        
                    </tr>
                    <tr style="background-color: white; color: black">
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.itemName}</td> 
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.buying_price}</td>
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.price}</td>
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.quantity}</td>
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.checkedIn_quantity}</td>
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.checkedIn_date}</td>                        
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.totalSold}</td>
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.expected_total_sale}</td>
                        <td style="border: 1.5px solid #ccc; padding: 10px; text-align: left;">${dataToMail.valueOfItems}</td>                        
                    </tr>

        </table> <hr>
         <small>This is a system generated mail. Please do not reply to it</small>
         <hr>
         </div>       
         `
        }

        mail.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);

                var sql = "UPDATE p_items SET mail_sent_yn='Y' WHERE id=?";
                connAttrs.query(sql, dataToMail.id, function (error, results) {
                    if (error) {
                        res.set('Content-Type', 'application/json');
                        var status = 500;
                        res.status(status).send(JSON.stringify({
                            status: status,
                            message: "Error Sending the mail",
                            detailed_message: error
                        }));
                        return (error);
                    }


                    res.contentType('application/json').status(201).send(JSON.stringify(results));

                });
            }
        });
    });
});


router.get('/', function (req, res) {
    return res.redirect('https://zyptech.co.ke/')
});

// m
async function getOauthToken() {
    try {
        let response = await axios.get(url, {
            headers: {
                "Authorization": auth
            }
        })
        oauth_token = response.data.access_token;
    } catch (error) {
        console.log("Auth Error: ", error.response);
    }
}

function startInterval(seconds) {
    setInterval(function () { getOauthToken() }, seconds * 1000);
}

function pad2(n) { return n < 10 ? '0' + n : n }

function formatDate() {
    let date = new Date();
    let correctDate =
        date.getFullYear().toString() +
        pad2(date.getMonth() + 1) +
        pad2(date.getDate()) +
        pad2(date.getHours()) +
        pad2(date.getMinutes()) +
        pad2(date.getSeconds());
    return correctDate;
}


function startInterval(seconds) {
    setInterval(function () { getOauthToken() }, seconds * 1000);
}

function pad2(n) { return n < 10 ? '0' + n : n }

function formatDate() {
    let date = new Date();
    let correctDate =
        date.getFullYear().toString() +
        pad2(date.getMonth() + 1) +
        pad2(date.getDate()) +
        pad2(date.getHours()) +
        pad2(date.getMinutes()) +
        pad2(date.getSeconds());
    return correctDate;
}

router.post("/mpesa", function (req, res) {
    getOauthToken();
    if (req.body.phoneNumber && req.body.amount) {
        let timestamp = formatDate();
        let url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            password = Buffer.from(shortcode + passkey + timestamp).toString("base64"),
            auth = "Bearer " + oauth_token;
        axios({
            method: 'POST',
            url: url,
            headers: {
                "Authorization": auth
            },
            data: {
                "BusinessShortCode": shortcode,                     //Your Business ShortCode
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": req.body.amount,                          //Amount to be paid
                "PartyA": req.body.phoneNumber,                     //Number sending funds
                "PartyB": shortcode,                                //Business ShortCode receiving funds   
                "PhoneNumber": req.body.phoneNumber,                //Number sending funds
                "CallBackURL": "http://example.com/api/v1/c2bconfirmation", //Your confirmation Url
                "AccountReference": "Example",                      //Name to display to receiver of STK Push
                "TransactionDesc": "Testing mpesa"                  //Description of Transaction
            }
        }).then(response => {
            res.status(200).send('Stk push sent to phone');
            let responseBody = response.data;
            //Using the above responseBody handle the data.
        }).catch(error => {
            res.status(500).send('There was an error');
            console.error(`LNMO error is: ${error}`);
        });
    } else {
        res.status(400).send('Bad request');
    }
});

// C2B ConfirmationURL - /api/v1/c2b/confirmation
router.post('/api/v1/c2b/confirmation', function (req, res) {
    console.log('-----------C2B CONFIRMATION REQUEST------------');
    console.log(prettyjson.render(req.body, prettyJsonOptions));
    console.log('-----------------------');

    let message = {
        "ResultCode": 0,
        "ResultDesc": "Success"
    };
    res.json(message);
});

module.exports = router;

