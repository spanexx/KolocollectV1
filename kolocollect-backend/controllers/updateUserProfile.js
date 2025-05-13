// Update User Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, address, bio } = req.body;

    if (!name && !email && !phone && !address && !bio) {
      return res.status(400).json({
        error: {
          code: 'UPDATE_PROFILE_ERROR',
          message: 'No fields to update were provided.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/UPDATE_PROFILE_ERROR"
        }
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/USER_NOT_FOUND"
        }
      });
    }

    // Update only provided fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (bio !== undefined) user.bio = bio;

    // Add activity log entry
    user.activityLog.push({
      action: 'updated profile',
      details: 'User profile information updated',
      date: new Date()
    });

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({
      error: {
        code: 'UPDATE_PROFILE_ERROR',
        message: 'Failed to update user profile.',
        timestamp: new Date().toISOString(),
        documentation: "https://api.kolocollect.com/docs/errors/UPDATE_PROFILE_ERROR"
      }
    });
  }
};
