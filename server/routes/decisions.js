const express = require("express");
const { Decision, VoteDecision, RandomDecision } = require("../models/Decision");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const decisions = await Decision.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(decisions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch decisions", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const decision = await Decision.findById(req.params.id).lean();

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    return res.status(200).json(decision);
  } catch (error) {
    return res.status(400).json({ message: "Invalid decision id", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const Model = req.body.selectionMode === "random" ? RandomDecision : VoteDecision;
    const decision = await Model.create(req.body);
    res.status(201).json(decision);
  } catch (error) {
    res.status(400).json({ message: "Failed to create decision", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await Decision.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return res.status(404).json({ message: "Decision not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ message: "Failed to update decision", error: error.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;

  try {
    const updated = await Decision.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Decision not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ message: "Failed to update status", error: error.message });
  }
});

router.post("/:id/participants", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Participant name is required" });
  }

  try {
    const decision = await Decision.findById(req.params.id);

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    if (decision.selectionMode !== "vote") {
      return res.status(400).json({ message: "Cannot join a random decision" });
    }

    if (decision.participants.length >= decision.maxParticipants) {
      return res.status(400).json({ message: "Decision has reached max participants" });
    }

    const duplicate = decision.participants.some(
      (participant) => participant.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (duplicate) {
      return res.status(409).json({ message: "Participant has already joined this decision" });
    }

    decision.participants.push({ name: name.trim(), email: email || "" });
    await decision.save();

    return res.status(201).json(decision);
  } catch (error) {
    return res.status(400).json({ message: "Failed to add participant", error: error.message });
  }
});

router.post("/:id/vote", async (req, res) => {
  const { voterName, option } = req.body;

  if (!voterName || !voterName.trim()) {
    return res.status(400).json({ message: "Voter name is required" });
  }

  if (!option || !option.trim()) {
    return res.status(400).json({ message: "Option is required" });
  }

  try {
    const decision = await Decision.findById(req.params.id);

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    if (decision.selectionMode !== "vote") {
      return res.status(400).json({ message: "Decision is not in vote mode" });
    }

    if (decision.status !== "active") {
      return res.status(400).json({ message: "Decision is not active" });
    }

    const cleanOption = option.trim();
    if (!decision.options.includes(cleanOption)) {
      return res.status(400).json({ message: "Invalid option selected" });
    }

    const cleanName = voterName.trim();
    const existingParticipant = decision.participants.find(
      (participant) => participant.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existingParticipant && existingParticipant.hasVoted) {
      return res.status(409).json({ message: "This participant already voted" });
    }

    if (!existingParticipant && decision.participants.length >= decision.maxParticipants) {
      return res.status(400).json({ message: "Decision has reached max participants" });
    }

    if (existingParticipant) {
      existingParticipant.hasVoted = true;
    } else {
      decision.participants.push({
        name: cleanName,
        email: "",
        hasVoted: true,
      });
    }

    const currentCount = decision.votes.get(cleanOption) || 0;
    decision.votes.set(cleanOption, currentCount + 1);

    const totalVotes = Array.from(decision.votes.values()).reduce((sum, count) => sum + count, 0);
    const votedParticipants = decision.participants.filter((participant) => participant.hasVoted).length;
    const reachedTallyTarget = decision.tallyTarget > 0 && totalVotes >= decision.tallyTarget;
    const reachedParticipantLimit = decision.maxParticipants > 0 && votedParticipants >= decision.maxParticipants;

    if (reachedTallyTarget || reachedParticipantLimit) {
      decision.status = "closed";
    }

    await decision.save();
    return res.status(200).json(decision);
  } catch (error) {
    return res.status(400).json({ message: "Failed to submit vote", error: error.message });
  }
});

router.post("/:id/random-pick", async (req, res) => {
  try {
    const decision = await Decision.findById(req.params.id);

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    if (decision.selectionMode !== "random") {
      return res.status(400).json({ message: "Decision is not in random mode" });
    }

    if (decision.status !== "active") {
      return res.status(400).json({ message: "Decision is not active" });
    }

    if (!decision.options.length) {
      return res.status(400).json({ message: "No options available for random selection" });
    }

    const index = Math.floor(Math.random() * decision.options.length);
    decision.randomResult = decision.options[index];

    await decision.save();
    return res.status(200).json(decision);
  } catch (error) {
    return res.status(400).json({ message: "Failed to run random selection", error: error.message });
  }
});

module.exports = router;
