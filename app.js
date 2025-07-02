
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Imports
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require("connect-mongo");
const ExpressError = require("./utils/ExpressError");
const User = require("./models/user");

// Route Imports
const listingRoutes = require("./routes/listing");
const reviewRoutes = require("./routes/review");
const userRoutes = require("./routes/user2");

// MongoDB Atlas Connection
const dbUrl = process.env.ATLASDB_URL;

mongoose.connect(dbUrl)
  .then(() => console.log(" Connected to MongoDB Atlas"))
  .catch((err) => console.error(" MongoDB Atlas connection error:", err));

const app = express();

// EJS View Engine + Layouts
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session Store with MongoDB
const secret = process.env.SESSION_SECRET;

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: secret
  },
  touchAfter: 24 * 3600 // lazy update every 24h
});

store.on("error", (e) => {
  console.log("SESSION STORE ERROR:", e);
});

const sessionConfig = {
  store,
  secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    // secure: true, // Enable this on production with HTTPS
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
};
app.use(session(sessionConfig));
app.use(flash());

// Passport Config
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash Middleware
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Routes
app.use("/", userRoutes);
app.use("/listings", listingRoutes);
app.use("/listings/:id/reviews", reviewRoutes);

// Home Route
app.get("/", (req, res) => {
  res.render("home");
});

// 404 Handler
app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});

// Global Error Handler
app.use((err, req, res, next) => {
  const { status = 500, message = "Something went wrong" } = err;
  res.status(status).render("error", { err });
});

// Start Server
const PORT = process.env.PORT || 5008;
app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
