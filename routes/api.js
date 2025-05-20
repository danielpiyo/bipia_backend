const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt-nodejs");
const jwt = require("jsonwebtoken");
const path = require("path");
const config = require(__dirname + "/config_adm.js");
const multer = require("multer");
const nodemailer = require("nodemailer");
const cors = require("cors");

router.use(cors());

// Use body parser to parse JSON body
router.use(bodyParser.json());
const connAttrs = mysql.createConnection(config.connection);
console.log("Config Details", config.connection);
router.get("/", function (req, res) {
  res.sendfile("/");
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "routes/uploads/"); // Specify the destination directory for uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Route handling the file upload
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  console.log(req.file);
  // Get the file path
  const filePath = path.join(__dirname, "uploads", req.file.filename);
  // Perform additional processing or validation if needed
  console.log("FilesHere", req.name);
  res.status(200).json({ message: "File uploaded successfully", filePath });
});

// login
router.post("/signin", function (req, res) {
  let user1 = {
    email: req.body.email,
    password: req.body.password,
  };
  console.log(user1);
  if (!user1) {
    return res.status(400).send({
      error: true,
      message: "Please provide login details",
    });
  }
  connAttrs.query(
    "SELECT password, email, org_id, id, pUpdated_yn, docUploaded_yn, courseApp_yn, role, DATE_FORMAT(dade_date, '%Y-%m-%d') dade_date FROM users where email=? AND deleted_yn ='N' AND (dade_date - curdate()) > 0",
    user1.email,
    function (error, result) {
      if (error || result < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the that email"
              : "Invalid Credentials.Please try again or Contact systemadmin",
            detailed_message: error ? error.message : "",
          })
        );
        console.log(
          "========= You have Got an error ================ for this User: " +
            user1.email
        );
        return error;
      } else {
        user = result[0];
        // console.log(user);

        bcrypt.compare(
          user1.password,
          user.password,
          function (error, pwMatch) {
            var payload;
            if (error) {
              return error;
            }
            if (!pwMatch) {
              res.status(401).send({
                message: "Wrong Password. please Try Again .",
              });
              return;
            }
            payload = {
              email: user.email,
              entity_id: user.id,
              role: user.role,
              org: user.org_id,
              close_date: user.dade_date,
            };

            res.status(200).json({
              user: {
                // username: user.username,
                role: user.role,
                email: user.email,
                profile_updated: user.pUpdated_yn,
                doc_updated: user.docUploaded_yn,
                course_applied: user.courseApp_yn,
                dade_date: user.dade_date,
              },
              token: jwt.sign(payload, config.jwtSecretKey, {
                expiresIn: 60 * 60 * 24,
              }), //EXPIRES IN ONE DAY,
            });
            // console.log(user);
          }
        );
      }
    }
  );
});

// register a new user
router.post("/register", function post(req, res, next) {
  //
  console.log(req.body, config.connection);
  var user = {
    fname: req.body.fname,
    lname: req.body.lname,
    email: req.body.email,
    org_id: req.body.org_id,
  };
  var unhashedPassword = req.body.password;
  bcrypt.genSalt(10, function (err, salt) {
    if (err) {
      return next(err);
    }
    // console.log(password);
    bcrypt.hash(unhashedPassword, salt, null, function (err, hash) {
      if (err) {
        return next(err);
      }
      // console.log(hash);
      user.hashedPassword = hash;

      connAttrs.query(
        "SELECT * FROM users where email=?",
        user.email,
        function (error, result) {
          if (error || result.length > 0) {
            res.set("Content-Type", "application/json");
            var status = error ? 500 : 404;
            res.status(status).send(
              JSON.stringify({
                status: status,
                message: error
                  ? "Error getting the server"
                  : "Email you have entered is already taken.",
                detailed_message: error
                  ? error.message
                  : `Please this ${user.email} has been taken use another one`,
              })
            );
            console.log(error);
            return error;
          }
          connAttrs.query(
            "INSERT INTO users SET ? ",
            {
              email: user.email,
              fname: user.fname,
              lname: user.lname,
              password: user.hashedPassword,
              org_id: user.org_id,
            },
            function (error, results) {
              if (error) {
                res.set("Content-Type", "application/json");
                res.status(500).send(
                  JSON.stringify({
                    status: 500,
                    message: "Error Posting your details",
                    detailed_message: error.message,
                  })
                );
              } else {
                console.log(
                  `${user.email}, succesfully added on ${new Date()}`
                );
                let dataToMail = {
                  mailSender: "ruwebsite@riarauniversity.ac.ke",
                  subject:
                    "Successful registration to the RU Self Onboarding Platform",
                  recipient: user.email,
                  recipientName: user.fname,
                  bodyContent: `Congratulations on your successful registration! We are thrilled to have you join our community.<br>
                  Click the link to activate you Account
                  `,
                };
                sendMail(dataToMail);
                return res
                  .contentType("application/json")
                  .status(201)
                  .send(JSON.stringify(results));
              }
            }
          );
        }
      );
    });
  });
});

// adding product categories
router.post("/newCategory", function (req, res) {
  var category = {
    name: req.body.category_name,
    details: req.body.details,
  };
  // token
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    connAttrs.query(
      "SELECT * FROM category where category_name=? and deleted_yn='N' and org_id=?",
      category.name,
      decoded.org,
      function (error, result) {
        if (error || result.length > 0) {
          res.set("Content-Type", "application/json");
          var status = error ? 500 : 404;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: error
                ? "Error getting the server"
                : `Category you have entered was already captured on ${result[0].created_date}`,
              detailed_message: error
                ? error.message
                : `If category ${category.name} is nolonger in use please remove it from the system`,
            })
          );
          console.log("error occured");
          return error;
        }
        connAttrs.query(
          "INSERT INTO category SET ? ",
          {
            category_name: category.name,
            details: category.details,
            created_by: decoded.entity_id,
            org_id: decoded.org,
          },
          function (error, results) {
            if (error) {
              res.set("Content-Type", "application/json");
              res.status(500).send(
                JSON.stringify({
                  status: 500,
                  message: "Error Posting new Category",
                  detailed_message: error.message,
                })
              );
            } else {
              console.log(
                `${decoded.role}, succesfully added category: ${
                  category.name
                } on ${new Date()}`
              );
              return res
                .contentType("application/json")
                .status(201)
                .send(JSON.stringify(results));
            }
          }
        );
      }
    );
  });
});

// Updating Profile
router.post("/updateBasic", function (req, res) {
  // token
  var token = req.body.token;
  console.log(req.body);
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }

    connAttrs.query(
      "INSERT INTO student_details SET ? ",
      {
        user_id: decoded.entity_id,
        sir_name: req.body.sirname,
        middle_name: req.body.middlename,
        last_name: req.body.lastname,
        id_no: req.body.id_no,
        contact: req.body.phone,
        dob: req.body.dob,
        gender: req.body.gender,
        org_id: decoded.org,
        sponsor: req.body.sname,
        basic_yn: "Y",
        // details: req.body.details,
        home_county: req.body.hcounty,
        home_adress: req.body.hadress,
        school: req.body.school,
        kcse: req.body.kcse,
        kcpe: req.body.kcpe,
        s_phone: req.body.sphone,
        s_adress: req.body.sadress,
        nationality: req.body.nationality,
        religion: req.body.religion,
        residance: req.body.residance,
        program_school: req.body.program_school,
        year_school: req.body.year_school,
        max_marks: req.body.max_marks,
        my_marks: req.body.my_marks,
        result: req.body.result,
      },
      function (error, results) {
        if (error) {
          console.log(error);
          res.set("Content-Type", "application/json");
          res.status(500).send(
            JSON.stringify({
              status: 500,
              message: "Error updating the details",
              detailed_message: error.message,
            })
          );
        } else {
          console.log(
            `${decoded.role}: ${
              decoded.email
            }, succesfully updated basic details on ${new Date()}`
          );
          return res
            .contentType("application/json")
            .status(201)
            .send(JSON.stringify(results));
        }
      }
    );
  });
});

// pulling existing categories
router.post("/myprofile", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM student_details WHERE user_id=?";
    connAttrs.query(sql, decoded.entity_id, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Data found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records set. Kindly contact Admin",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `User details succesfullly by ${decoded.email} on ${new Date()}`
      );
    });
  });
});

// pulling all the  categories of cources available
router.post("/allCategory", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT id, category_name, details from categories where deleted_yn='N' and org_id=?";
    connAttrs.query(sql, decoded.org, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Categories found",
            detailed_message: error
              ? error.message
              : "Sorry Course category for your application. Kindly check Your inbox",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `All Course Categories selection Released succesfullly by ${
          decoded.email
        } on ${new Date()}`
      );
    });
  });
});

// pulling all the  cources  available
router.post("/courses", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT id, course_name, course_category, period, details from courses where deleted_yn='N' and org_id=?";
    connAttrs.query(sql, decoded.org, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Courses found",
            detailed_message: error
              ? error.message
              : "Sorry Course for your application. Kindly check Your inbox",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `All Course selection Released succesfullly by ${
          decoded.email
        } on ${new Date()}`
      );
    });
  });
});

// Applying for the course
router.post("/applyCourse", function (req, res) {
  // token
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }

    connAttrs.query(
      "INSERT INTO course_application SET ? ",
      {
        course_id: req.body.id,
        user_id: decoded.entity_id,
        created_by: decoded.entity_id,
      },
      function (error, results) {
        if (error) {
          res.set("Content-Type", "application/json");
          res.status(500).send(
            JSON.stringify({
              status: 500,
              message: "Error updating the details",
              detailed_message: error.message,
            })
          );
        } else {
          console.log(
            `${decoded.role}: ${decoded.email}, succesfully Applied for ${
              req.body.courseName
            } on ${new Date()}`
          );
          return res
            .contentType("application/json")
            .status(201)
            .send(JSON.stringify(results));
        }
      }
    );
  });
});

/**Updating file data*/
router.post("/uploadSaveFile", function (req, res) {
  // token
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }

    connAttrs.query(
      "INSERT INTO user_documents SET ? ",
      {
        user_id: decoded.entity_id,
        doc_name: req.body.doc_name,
        doc_link: req.body.doc_link,
        created_by: decoded.entity_id,
      },
      function (error, results) {
        if (error) {
          res.set("Content-Type", "application/json");
          res.status(500).send(
            JSON.stringify({
              status: 500,
              message: "Error Uploading the file",
              detailed_message: error.message,
            })
          );
        } else {
          console.log(
            `${decoded.role}: ${
              decoded.email
            }, succesfully Uploaded the file for ${
              req.body.doc_name
            } on ${new Date()}`
          );
          return res
            .contentType("application/json")
            .status(201)
            .send(JSON.stringify(results));
        }
      }
    );
  });
});

// pulling User application History
router.post("/ApplicationHistory", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * from vw_user_application_history where user_id=?";
    connAttrs.query(sql, decoded.entity_id, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Application history found",
            detailed_message: error
              ? error.message
              : "Seems like you have not applied yet. Please apply first",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Application History selection Released succesfullly by ${
          decoded.email
        } on ${new Date()}`
      );
    });
  });
});

// pulling User application History
router.post("/AppStatus", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT docUploaded_yn, courseApp_yn, pUpdated_yn  from users where id=?";
    connAttrs.query(sql, decoded.entity_id, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Data found",
            detailed_message: error
              ? error.message
              : "Seems like you have not applied yet. Please apply first",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Application status selection Released succesfullly by ${
          decoded.email
        } on ${new Date()}`
      );
    });
  });
});

/**
 * Sending Mail
 */
const sendMail = async (dataToMail) => {
  try {
    var mail = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: true, // true for 465, false for other ports
      auth: {
        user: dataToMail.mailSender,
        pass: "CSEeM2<abj7Q9uV%?",
      },
    });

    var mailOptions = {
      from: dataToMail.mailSender,
      to: dataToMail.recipient,
      subject: dataToMail.subject,
      html: `<div style="border-color: #337ab7; border-radius:6px; border: 0px solid #337ab7;">
        <div style=" padding: 5px 5px; border-bottom: 1px solid transparent; border-top-left-radius: 3px;
         border-top-right-radius: 3px; color: #fff; background-color: #337ab7; border-color: #337ab7;">
     <h2 style="color:black"><img src="https://riarauniversity.ac.ke/wp-content/uploads/2014/10/logo-riara-e1655472443775.png"></h2>
     </div>
     <h3>Dear ${dataToMail.recipientName},</h3> <br>
     <p>${dataToMail.bodyContent}</p>
     <hr>
     <small>This is a system generated mail. Please do not reply to it</small>
     <hr>
     </div>       
     `,
      //  ,
      //  attachments: [{
      //      filename: 'text1.txt',
      //      content: 'hello world!'
      //  }]
    };

    mail.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);

        var sql = "UPDATE users SET mail_sent_yn='Y' WHERE email=?";
        connAttrs.query(sql, dataToMail.recipient, function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            var status = 500;
            res.status(status).send(
              JSON.stringify({
                status: status,
                message: "Error Sending the mail",
                detailed_message: error,
              })
            );
            return error;
          }

          res
            .contentType("application/json")
            .status(201)
            .send(JSON.stringify(results));
        });
      }
    });
  } catch (error) {
    console.error(error);
    // await delay(5000); // Wait for 5 seconds
    // Retry the operation
  }
};

// pulling all the items
router.post("/allitems", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * from vw_all_items";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Items or products found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Products set. Please consider setting up new products",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `All Items selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// all items with discount enabled
router.post("/allitemsDiscount", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "select * from vw_items_for_sale_discounted";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Items or products found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Products set. Please consider setting up new products",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `All Items selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// pulling items for particular category
router.post("/itemsCategory", function (req, res) {
  var category_id = req.body.category_id;
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM p_items where category_id=? AND deleted_yn='N'";
    connAttrs.query(sql, category_id, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Items or products found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Products set. Please consider setting up new products",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Items for category ${category_id},  Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// posting checkout logs
router.post("/checkOut", function (req, res) {
  var check_out = {
    category_id: req.body.category_id,
    item_id: req.body.item_id,
    discounted: req.body.discounted,
    quantity_from: req.body.quantity_from,
    quantity_to: req.body.quantity_to,
    item_price: req.body.item_price,
    contact: req.body.contact,
    payment_mode: req.body.payment_mode,
  };
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "INSERT INTO p_logs SET?";
    connAttrs.query(
      sql,
      {
        category_id: check_out.category_id,
        item_id: check_out.item_id,
        created_by: decoded.entity_id,
        discounted: check_out.discounted,
        log_name: "Check Out",
        quantity_from: check_out.quantity_from,
        quantity_to: check_out.quantity_to,
        customer_contact: check_out.contact,
        payment_mode: check_out.payment_mode,
        sold_amount:
          (check_out.quantity_from - check_out.quantity_to) *
          check_out.item_price,
      },
      function (error, result) {
        if (error) {
          res.set("Content-Type", "application/json");
          var status = 500;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: "Error getting the server",
              detailed_message: error,
            })
          );
          return error;
        }

        res
          .contentType("application/json")
          .status(200)
          .send(JSON.stringify(result));
        console.log(
          `Item of id: ${check_out.item_id},  checkout succesfullly by ${
            decoded.username
          } on ${new Date()}`
        );
      }
    );
  });
});

// posting checkin logs
router.post("/checkIn", function (req, res) {
  var check_in = {
    category_id: req.body.category_id,
    item_id: req.body.item_id,
    quantity_from: req.body.quantity_from,
    quantity_to: req.body.quantity_to,
    item_price: req.body.item_price,
    invoice_number: req.body.invoice_number,
    buying_price: req.body.buying_price,
  };
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "INSERT INTO p_logs SET?";
    connAttrs.query(
      sql,
      {
        category_id: check_in.category_id,
        item_id: check_in.item_id,
        created_by: decoded.entity_id,
        log_name: "Check In",
        invoice_number: check_in.invoice_number,
        quantity_from: check_in.quantity_from,
        quantity_to: check_in.quantity_to,
        value_added_items:
          (check_in.quantity_to - check_in.quantity_from) * check_in.item_price,
        cost_incured:
          (check_in.quantity_to - check_in.quantity_from) *
          check_in.buying_price,
      },
      function (error, result) {
        if (error) {
          res.set("Content-Type", "application/json");
          var status = 500;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: "Error getting the server",
              detailed_message: error,
            })
          );
          return error;
        }

        res
          .contentType("application/json")
          .status(200)
          .send(JSON.stringify(result));
        console.log(
          `${check_in.quantity_to - check_in.quantity_from} Items of id: ${
            check_in.item_id
          },  checkIn succesfullly by ${decoded.username} on ${new Date()}`
        );
      }
    );
  });
});

// price change functionality
router.post("/priceChange", function (req, res) {
  var price_change = {
    category_id: req.body.category_id,
    item_id: req.body.item_id,
    price_from: req.body.price_from,
    price_to: req.body.price_to,
  };
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "INSERT INTO p_logs SET?";
    connAttrs.query(
      sql,
      {
        category_id: price_change.category_id,
        item_id: price_change.item_id,
        created_by: decoded.entity_id,
        log_name: "Price Changed",
        price_from: price_change.price_from,
        price_to: price_change.price_to,
      },
      function (error, result) {
        if (error) {
          res.set("Content-Type", "application/json");
          var status = 500;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: "Error getting the server",
              detailed_message: error,
            })
          );
          return error;
        }

        res
          .contentType("application/json")
          .status(200)
          .send(JSON.stringify(result));
        console.log(
          `Item of id: ${price_change.item_id},  Price has been changed from ${
            price_change.price_from
          } to ${price_change.price_to} succesfullly by ${
            decoded.username
          } on ${new Date()}`
        );
      }
    );
  });
});

// pulling all registerd users
router.post("/users", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM p_users WHERE deleted_yn='N'";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Users found",
            detailed_message: error
              ? error.message
              : "Sorry there are no User set. Please Add Users",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `User selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// pulling all Checkout reports for A day
router.post("/checkOutDay", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.all_check_out_reports WHERE days =0 and DATE_FORMAT(created_date, '%Y-%m-%d')=CURDATE() and discounted='N'";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Checkout Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// pulling all Checkout reports for A Day with discount yes
router.post("/checkOutDayDiscount", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.all_check_out_reports WHERE days =0 and DATE_FORMAT(created_date, '%Y-%m-%d')=CURDATE() and discounted='Y'";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Checkout Record for items with discount selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// all checkin Today
router.post("/checkInDay", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.all_check_in_reports WHERE days =0 and DATE_FORMAT(created_date, '%Y-%m-%d')=CURDATE()";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Checkin Record for day selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// all checkin performed
router.post("/allcheckInReport", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM pharmacy.all_check_in_reports";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `All Checkin Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// pulling all Checkout reports for A day
// router.post('/checkOutMonth', function (req, res) {

//     var token = req.body.token;
//     if (!token) return res.status(401).send({
//         auth: false,
//         message: 'No token provided.'
//     });

//     jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
//         if (err) {
//             return res.status(500).send({
//                 auth: false,
//                 message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
//             });
//         }
//         var sql = "SELECT * FROM all_check_out_reports WHERE days BETWEEN 0 AND 31";
//         connAttrs.query(sql, function (error, results) {
//             if (error || results.length < 1) {
//                 res.set('Content-Type', 'application/json');
//                 var status = error ? 500 : 404;
//                 res.status(status).send(JSON.stringify({
//                     status: status,
//                     message: error ? "Error getting the server" : "No Records found",
//                     detailed_message: error ? error.message : "Sorry there are no Records Found set."
//                 }));
//                 return (error);
//             }

//             res.contentType('application/json').status(200).send(JSON.stringify(results));
//             console.log(`Checkout Record selection Released succesfullly by ${decoded.username} on ${new Date()}`);
//         });
//     });
// });

// for graphs
// pulling all Checkout reports for A day for chart view
router.post("/checkOutDayChart", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT item name, amountSold value FROM pharmacy.all_check_out_reports WHERE days =0 and DATE_FORMAT(created_date, '%Y-%m-%d')=CURDATE()";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for daily chart",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found for daily chart.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Daily Checkout Record for chart selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// pulling all Checkout reports for A week for chart
router.post("/checkOutWeekChart", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT item name, amountSold value FROM pharmacy.all_check_out_reports WHERE created_date <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_date >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) ORDER BY created_date DESC";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for weekly chart",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found for weekly chart.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Weekly Checkout chart Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// pulling all Checkout reports for A month
router.post("/checkOutMonthChart", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT item name, amountSold value FROM pharmacy.all_check_out_reports WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) ORDER BY created_date DESC";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for monthly chart",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found for monthly chart.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Monthly Checkout chart Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// supplier monthly report
router.post("/suppliersReport", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.VW_SUPPLIER_REPORT WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) ORDER BY created_date DESC";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for Supplier this month",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found for monthly supplier details.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Monthly supplier report Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// // Item update
router.post("/updateCategory", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      console.log("sub", decoded.sub);
      let itemToUpdate = {
        category_name: req.body.category_name,
        id: req.body.id,
        description: req.body.description,
        updated_by: decoded.username,
        updated_at: new Date(),
      };

      if (!itemToUpdate) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql =
        "UPDATE p_category SET description=?, category_name=?, updated_date = ?, updated_by=? WHERE id=?";
      connAttrs.query(
        sql,
        [
          itemToUpdate.description,
          itemToUpdate.category_name,
          itemToUpdate.updated_at,
          itemToUpdate.updated_by,
          itemToUpdate.id,
        ],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Updating category",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/update Released========================="
      );
    }
  });
});

// delete category
router.post("/deleteCategory", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let categoryTodelete = {
        id: req.body.id,
        deleted_by: decoded.username,
      };

      if (!categoryTodelete) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql = "UPDATE p_category SET deleted_yn='Y', deleted_by=? WHERE id=?";
      connAttrs.query(
        sql,
        [categoryTodelete.deleted_by, categoryTodelete.id],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Deleteing your details",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/CategoryDelete Released========================="
      );
    }
  });
});

// delete Item
router.post("/deleteItem", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let itemTodelete = {
        id: req.body.id,
        deleted_by: decoded.username,
      };

      if (!itemTodelete) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql = "UPDATE p_items SET deleted_yn='Y', deleted_by=? WHERE id=?";
      connAttrs.query(
        sql,
        [itemTodelete.deleted_by, itemTodelete.id],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Deleteing your details",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/ItemDelete Released========================="
      );
    }
  });
});

// delete User
router.post("/deleteUser", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let userTodelete = {
        id: req.body.id,
        deleted_by: decoded.username,
      };

      if (!userTodelete) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql = "UPDATE p_users SET deleted_yn='Y', deleted_by=? WHERE id=?";
      connAttrs.query(
        sql,
        [userTodelete.deleted_by, userTodelete.id],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Deleteing your details",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/UserDelete Released========================="
      );
    }
  });
});

// updating item
router.post("/updateItem", function (req, res) {
  var itemToUpdate = {
    item_name_from: req.body.item_name_from,
    item_name_to: req.body.item_name_to,
    buying_price_from: req.body.buying_price_from,
    buying_price_to: req.body.buying_price_to,
    min_price_from: req.body.min_price_from,
    min_price_to: req.body.min_price_to,
    category_id: req.body.category_id,
    category_id_from: req.body.category_id_from,
    quantity_from: req.body.quantity_from,
    quantity_to: req.body.quantity_to,
    discount_yn_before: req.body.discount_yn_before,
    discount_yn_after: req.body.discount_yn_after,
    description_from: req.body.description_from,
    description_to: req.body.description_to,
    original_expire_date: req.body.original_expire_date,
    new_expire_date: req.body.new_expire_date,
    item_id: req.body.item_id,
  };
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "INSERT INTO p_logs SET?";
    connAttrs.query(
      sql,
      {
        category_id: itemToUpdate.category_id,
        category_id_from: itemToUpdate.category_id_from,
        item_id: itemToUpdate.item_id,
        item_name_from: itemToUpdate.item_name_from,
        item_name_to: itemToUpdate.item_name_to,
        buying_price_from: itemToUpdate.buying_price_from,
        buying_price_to: itemToUpdate.buying_price_to,
        min_price_from: itemToUpdate.min_price_from,
        min_price_to: itemToUpdate.min_price_to,
        quantity_from: itemToUpdate.quantity_from,
        quantity_to: itemToUpdate.quantity_to,
        discount_yn_before: itemToUpdate.discount_yn_before,
        discount_yn_after: itemToUpdate.discount_yn_after,
        description_from: itemToUpdate.description_from,
        description_to: itemToUpdate.description_to,
        original_expire_date: itemToUpdate.original_expire_date,
        new_expire_date: itemToUpdate.new_expire_date,
        created_by: decoded.entity_id,
        log_name: "Item Edit",
      },
      function (error, result) {
        if (error) {
          res.set("Content-Type", "application/json");
          var status = 500;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: "Error getting the server",
              detailed_message: error,
            })
          );
          return error;
        }

        res
          .contentType("application/json")
          .status(201)
          .send(JSON.stringify(result));
        console.log(
          `Item : ${
            itemToUpdate.item_name_from
          }, has been Edited succesfullly by ${
            decoded.username
          } on ${new Date()}`
        );
      }
    );
  });
});

// reports for checked out products
// router.post('/productReportCheckOut', function (req, res) {

//     var token = req.body.token;
//     if (!token) return res.status(401).send({
//         auth: false,
//         message: 'No token provided.'
//     });

//     jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
//         if (err) {
//             return res.status(500).send({
//                 auth: false,
//                 message: 'Sorry Your Token is not genuine. Failed to authenticate token.'
//             });
//         }
//         var sql = "SELECT  item, category, SUM(DISTINCT amountSOld) total FROM all_check_out_reports GROUP BY item, category";
//         connAttrs.query(sql, function (error, results) {
//             if (error || results.length < 1) {
//                 res.set('Content-Type', 'application/json');
//                 var status = error ? 500 : 404;
//                 res.status(status).send(JSON.stringify({
//                     status: status,
//                     message: error ? "Error getting the server" : "No Records found",
//                     detailed_message: error ? error.message : "Sorry there are no Records Found set."
//                 }));
//                 return (error);
//             }

//             res.contentType('application/json').status(200).send(JSON.stringify(results));
//             console.log(`Checkout Record selection Released succesfullly by ${decoded.username} on ${new Date()}`);
//         });
//     });
// });

// weekly report on product checkout
router.post("/productReportCheckOutWeekly", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT item AS name, SUM(DISTINCT amountSOld) AS value FROM pharmacy.all_check_out_reports WHERE created_date <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_date >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) group by DATE_FORMAT(created_date, '%Y-%m-%d'), item ORDER BY DATE_FORMAT(created_date, '%Y-%m-%d') ASC";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Checkout Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// monthly report on product checkout
router.post("/productCheckOutMonthly", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT DATE_FORMAT(created_date, '%Y-%m-%d') AS DATE, item AS name, SUM(DISTINCT amountSOld) AS value FROM pharmacy.all_check_out_reports WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) group by DATE_FORMAT(created_date, '%Y-%m-%d'), item ORDER BY DATE_FORMAT(created_date, '%Y-%m-%d') ASC";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Montly Checkout Record selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// user performance in a week
router.post("/userPerfomanceWeek", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT DISTINCT createdBy AS name, SUM(amountSOld) value FROM pharmacy.all_check_out_reports WHERE created_date <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_date >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) GROUP BY createdBy;";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `UserPerformance in a week Report selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// user performance month
router.post("/userPerfomanceMonth", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT DISTINCT createdBy AS name, SUM(amountSOld) value FROM pharmacy.all_check_out_reports WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) GROUP BY createdBy";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `User performance in a month Report selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// suppler monthly spendingmonth
router.post("/supplierPerfomanceMonth", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT DISTINCT supplier AS name, SUM(cost_incured) value FROM pharmacy.VW_SUPPLIER_REPORT WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) GROUP BY supplier";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Records found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found set.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `Supplier cost performance in a month Report selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

// reset User Password
router.post("/resetPassoword", function post(req, res, next) {
  //

  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var unhashedPassword = req.body.password;
    bcrypt.genSalt(10, function (err, salt) {
      if (err) {
        return next(err);
      }
      bcrypt.hash(unhashedPassword, salt, null, function (err, hash) {
        if (err) {
          return next(err);
        }

        connAttrs.query(
          "UPDATE p_users SET password=? WHERE id=? ",
          [hash, req.body.id],
          function (error, results) {
            if (error) {
              res.set("Content-Type", "application/json");
              res.status(500).send(
                JSON.stringify({
                  status: 500,
                  message: "Error Resetting the password",
                  detailed_message: error.message,
                })
              );
            } else {
              // console.log(`${user.role}: ${user.username}, succesfully added by: ${user.created_by} on ${new Date()}`);
              return res
                .contentType("application/json")
                .status(201)
                .send(JSON.stringify(results));
            }
          }
        );
      });
    });
  });
});

// NUMBER OF ITEMS REMAINING (items runing out of stock. items equal to ten or less than ten)
router.post("/itemsTopup", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "select * from  pharmacy.runing_outStock_reports;";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for stock that are running low",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records for stock running low.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// USER REPORTS , DAILY, WEEKLY, MONTHLY
router.post("/userDaily", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.all_check_out_reports WHERE createdBy =? AND DATE_FORMAT(created_date, '%Y-%m-%d') = curdate() ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No User Records found for today",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// USER REPORTS  WEEKLY
router.post("/userWeekly", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.all_check_out_reports WHERE createdBy = ? AND created_date <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_date >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No User Records found for this week",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// USER REPORTS  MONTHLY
router.post("/userMonthly", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM pharmacy.all_check_out_reports WHERE createdBy =? AND created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No User Records found this month",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// USER REPORTS  WEEKLY ADMIN-VIEW
router.post("/userWeeklyAdminView", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  * FROM pharmacy.all_check_out_reports WHERE created_date <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_date >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) AND discounted='N' ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No User Records found for this week",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// USER REPORTS  MONTHLY ADMIN-VIEW
router.post("/userMonthlyAdminView", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  * FROM pharmacy.all_check_out_reports WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) AND discounted='N' ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No User Records found for this month",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// User monthly Discounted
router.post("/userMonthlyDiscountAdminView", function (req, res) {
  console.log("Here");
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  * FROM pharmacy.all_check_out_reports_discount WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) ORDER BY created_date DESC";
    connAttrs.query(sql, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No User Records found for this month",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// reports for general user's sales week
router.post("/userWeeklyAdminViewGeneral", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  * FROM pharmacy.all_check_out_reports WHERE created_date <= adddate(curdate(), INTERVAL 7-DAYOFWEEK(curdate()) DAY) AND created_date >= adddate(curdate(), INTERVAL 1-DAYOFWEEK(curdate()) DAY) ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for this week on Users",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// reports for general user's sales month
router.post("/userMonthlyAdminViewGeneral", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  * FROM pharmacy.all_check_out_reports WHERE created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found for this month on users",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// reports for general user's sales all
router.post("/userAllAdminViewGeneral", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  * FROM pharmacy.all_check_out_reports ORDER BY created_date DESC";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Records found on users",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records Found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// puling all the logs for admin view
router.post("/adminViewLogs", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT  * FROM pharmacy.all_logs order by created_date desc";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Logs found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records logs found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// sending mail to admin when stock go low
router.post("/sendMail", function (req, res) {
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
    username: req.body.username,
  };
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    //  mail
    var mailSender = "notification@zyptech.co.ke";

    var mail = nodemailer.createTransport({
      host: "mail.zyptech.co.ke",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: mailSender,
        pass: "zyptechUpdate@2020?",
      },
    });

    // var transporter = nodemailer.createTransport({
    //   host: 'zyptech.co.ke',
    // port: 465,
    //   secure: true, // true for 465, false for other ports
    //   auth: {
    //    user: 'notification@zyptech.co.ke', // your domain email address
    //    pass: 'zyptechUpdate@2020?' // your password
    //  }
    //  });

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
         `,
      //  ,
      //  attachments: [{
      //      filename: 'text1.txt',
      //      content: 'hello world!'
      //  }]
    };

    mail.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);

        var sql = "UPDATE p_items SET mail_sent_yn='Y' WHERE id=?";
        connAttrs.query(sql, dataToMail.id, function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            var status = 500;
            res.status(status).send(
              JSON.stringify({
                status: status,
                message: "Error Sending the mail",
                detailed_message: error,
              })
            );
            return error;
          }

          res
            .contentType("application/json")
            .status(201)
            .send(JSON.stringify(results));
        });
      }
    });
  });
});

// getting admin details to send mail to
router.post("/adminDetails", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT  email, username FROM p_users where role='admin' and deleted_yn ='N'";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Adminfound",
            detailed_message: error
              ? error.message
              : "Sorry there are no Records admin found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// getting sales details
router.post("/salesSummaryMonth", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM vw_sales_summary_ph";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Sales found",
            detailed_message: error
              ? error.message
              : "Sorry there are no sales found.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// getting AllExpences
router.post("/allExpences", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT * FROM p_expences where deleted_yn ='N' order by expence_id desc";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Expences found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Expences found yet.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// getting Monthly Expences
router.post("/monthlyExpences", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql =
      "SELECT expence_name name, expence_amount value FROM p_expences where created_date <= LAST_DAY(curdate()) AND created_date >= date_add(date_add(LAST_DAY(curdate()),interval 1 DAY),interval -1 MONTH) AND deleted_yn='N' order by expence_id desc";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error ? "Error getting the server" : "No Expences found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Expences found yet.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// getting Monthly cost
router.post("/monthlyCost", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM vw_monthly_cost";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Monthly cost found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Monthly cost found yet.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// getting Monthly Sales
router.post("/monthlySales", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM vw_monthly_sales";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Monthly Sales found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Monthly Sales found yet.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// posting new Expence
router.post("/newExpence", function (req, res) {
  var expence = {
    expence_name: req.body.expence_name,
    expence_amount: req.body.expence_amount,
    details: req.body.details,
  };
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "INSERT INTO p_expences SET?";
    connAttrs.query(
      sql,
      {
        expence_name: expence.expence_name,
        expence_amount: expence.expence_amount,
        details: expence.details,
      },
      function (error, result) {
        if (error) {
          res.set("Content-Type", "application/json");
          var status = 500;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: "Error getting the server",
              detailed_message: error,
            })
          );
          return error;
        }

        res
          .contentType("application/json")
          .status(201)
          .send(JSON.stringify(result));
        console.log(
          `New Expence : ${
            expence.expence_name
          }, has been Added succesfullly by ${
            decoded.username
          } on ${new Date()}`
        );
      }
    );
  });
});

// // update Expense
router.post("/updateExpence", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let expenceToUpdate = {
        expence_id: req.body.expence_id,
        expence_name: req.body.expence_name,
        expence_amount: req.body.expence_amount,
        details: req.body.details,
        updated_by: decoded.username,
        updated_at: new Date(),
      };

      if (!expenceToUpdate) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql =
        "UPDATE p_expences SET expence_name=?, expence_amount=?, details=?, updated_at = ?, updated_by=? WHERE expence_id=? and deleted_yn='N'";
      connAttrs.query(
        sql,
        [
          expenceToUpdate.expence_name,
          expenceToUpdate.expence_amount,
          expenceToUpdate.details,
          expenceToUpdate.updated_at,
          expenceToUpdate.updated_by,
          expenceToUpdate.expence_id,
        ],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Updating Invoces",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/expence update Released========================="
      );
    }
  });
});

// // expence delete
router.post("/deleteExpence", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let expenceToDelete = {
        expence_id: req.body.expence_id,
        deleted_by: decoded.username,
        deleted_at: new Date(),
      };

      if (!expenceToDelete) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql = "UPDATE p_expences SET deleted_yn='Y' WHERE expence_id=?";
      connAttrs.query(
        sql,
        [expenceToDelete.expence_id],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Deleting Expence",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/Expence Deleting Released========================="
      );
    }
  });
});

// posting new Invoice
router.post("/newInvoice", function (req, res) {
  var invoice = {
    invoice_number: req.body.invoice_number,
    supplier: req.body.supplier,
    supplier_contact: req.body.supplier_contact,
  };
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "INSERT INTO p_invoice SET?";
    connAttrs.query(
      sql,
      {
        invoice_number: invoice.invoice_number,
        supplier: invoice.supplier,
        supplier_contact: invoice.supplier_contact,
      },
      function (error, result) {
        if (error) {
          res.set("Content-Type", "application/json");
          var status = 500;
          res.status(status).send(
            JSON.stringify({
              status: status,
              message: "Error getting the server",
              detailed_message: error,
            })
          );
          return error;
        }

        res
          .contentType("application/json")
          .status(201)
          .send(JSON.stringify(result));
        console.log(
          `New Invoice : ${
            invoice.invoice_number
          }, has been Added succesfullly by ${
            decoded.username
          } on ${new Date()}`
        );
      }
    );
  });
});

// getting all Invoices
router.post("/allInvoices", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * FROM p_invoice where deleted_yn='N' order by id desc";
    connAttrs.query(sql, decoded.username, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Monthly Sales found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Invoices found yet.",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
    });
  });
});

// // Invoice update
router.post("/updateInvoice", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let invoiceToUpdate = {
        supplier: req.body.supplier,
        id: req.body.id,
        supplier_contact: req.body.supplier_contact,
        updated_by: decoded.username,
        updated_at: new Date(),
      };

      if (!invoiceToUpdate) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql =
        "UPDATE p_invoice SET supplier_contact=?, supplier=?, updated_at = ?, updated_by=? WHERE id=? and deleted_yn='N'";
      connAttrs.query(
        sql,
        [
          invoiceToUpdate.supplier_contact,
          invoiceToUpdate.supplier,
          invoiceToUpdate.updated_at,
          invoiceToUpdate.updated_by,
          invoiceToUpdate.id,
        ],
        function (error, results) {
          if (error) {
            res.set("Content-Type", "application/json");
            res.status(500).send(
              JSON.stringify({
                status: 500,
                message: "Error Updating Invoces",
                detailed_message: error.message,
              })
            );
          } else {
            return res
              .contentType("application/json")
              .status(201)
              .send(JSON.stringify(results));
          }
        }
      );

      console.log(
        "=========================================Post:/update Released========================="
      );
    }
  });
});

// // Invoice delete
router.post("/deleteInvoice", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    } else {
      let invoiceToDelete = {
        id: req.body.id,
        deleted_by: decoded.username,
        deleted_at: new Date(),
      };

      if (!invoiceToDelete) {
        return res.status(400).send({
          error: true,
          message: "Please provide details to send",
        });
      }
      let sql = "UPDATE p_invoice SET deleted_yn='Y' WHERE id=?";
      connAttrs.query(sql, [invoiceToDelete.id], function (error, results) {
        if (error) {
          res.set("Content-Type", "application/json");
          res.status(500).send(
            JSON.stringify({
              status: 500,
              message: "Error Deleting Invoces",
              detailed_message: error.message,
            })
          );
        } else {
          return res
            .contentType("application/json")
            .status(201)
            .send(JSON.stringify(results));
        }
      });

      console.log(
        "=========================================Post:/Deleting Released========================="
      );
    }
  });
});

// pulling all the Products per invoice
router.post("/productInvoice", function (req, res) {
  var token = req.body.token;
  if (!token)
    return res.status(401).send({
      auth: false,
      message: "No token provided.",
    });

  jwt.verify(token, config.jwtSecretKey, function (err, decoded) {
    if (err) {
      return res.status(500).send({
        auth: false,
        message:
          "Sorry Your Token is not genuine. Failed to authenticate token.",
      });
    }
    var sql = "SELECT * from vw_all_items where invoice=?";
    connAttrs.query(sql, req.body.invoice_number, function (error, results) {
      if (error || results.length < 1) {
        res.set("Content-Type", "application/json");
        var status = error ? 500 : 404;
        res.status(status).send(
          JSON.stringify({
            status: status,
            message: error
              ? "Error getting the server"
              : "No Items or products found",
            detailed_message: error
              ? error.message
              : "Sorry there are no Products set for that particular invoice. Please consider setting up new products",
          })
        );
        return error;
      }

      res
        .contentType("application/json")
        .status(200)
        .send(JSON.stringify(results));
      console.log(
        `All Products per invoice selection Released succesfullly by ${
          decoded.username
        } on ${new Date()}`
      );
    });
  });
});

module.exports = router;
