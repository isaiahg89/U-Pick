const mongoose = require("mongoose");

// Base schema — fields shared by both vote and random decisions.
// discriminatorKey: "selectionMode" means MongoDB stores "vote" or "random"
// in that field and Mongoose uses it to hydrate the correct model.
const baseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
    options: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.every((o) => typeof o === "string" && o.length <= 200),
        message: "Each option cannot exceed 200 characters",
      },
    },
  },
  {
    discriminatorKey: "selectionMode",
    timestamps: true,
    versionKey: false,
  }
);

const Decision = mongoose.model("Decision", baseSchema);

// Vote decisions — full participant/tally structure
const participantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Participant name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    hasVoted: {
      type: Boolean,
      default: false,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const VoteDecision = Decision.discriminator(
  "vote",
  new mongoose.Schema({
    tallyTarget: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxParticipants: {
      type: Number,
      min: 2,
      max: 1000,
      default: 10,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    votes: {
      type: Map,
      of: Number,
      default: {},
    },
    deadline: {
      type: Date,
      default: null,
    },
  })
);

// Random decisions — lean: just stores the picked result
const RandomDecision = Decision.discriminator(
  "random",
  new mongoose.Schema({
    randomResult: {
      type: String,
      trim: true,
      default: "",
    },
  })
);

module.exports = { Decision, VoteDecision, RandomDecision };
