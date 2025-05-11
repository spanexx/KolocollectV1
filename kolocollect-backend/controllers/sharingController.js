const Community = require('../models/Community');
const Contribution = require('../models/Contribution');
const Cycle = require('../models/Cycle');
const Midcycle = require('../models/Midcycle');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const config = require('../config/email');

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email,
    pass: config.password
  }
});

/**
 * Generate a PDF for a community
 */
exports.exportCommunityAsPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id)
      .populate('admin', 'name email')
      .populate('members.user', 'name email');

    if (!community) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Community not found' 
      });
    }

    // Create a temporary file path
    const fileName = `community-${id}-${uuidv4()}.pdf`;
    const filePath = path.join(__dirname, '..', 'temp', fileName);

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create PDF document
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // Generate PDF content
    doc.fontSize(18).text(`Community: ${community.name}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Description: ${community.description || 'No description available'}`, { align: 'left' });
    doc.moveDown();
    doc.text(`Created: ${new Date(community.createdAt).toDateString()}`);
    doc.text(`Status: ${community.status || 'Active'}`);
    doc.text(`Admin: ${community.admin.name} (${community.admin.email})`);
    doc.moveDown();

    // Community Settings
    doc.fontSize(14).text('Community Settings', { underline: true });
    doc.fontSize(12).moveDown();
    if (community.settings) {
      doc.text(`Minimum Contribution: €${community.settings.minContribution || 0}`);
      doc.text(`Maximum Members: ${community.settings.maxMembers || 'Unlimited'}`);
      doc.text(`Backup Fund Percentage: ${community.settings.backupFundPercentage || 0}%`);
      doc.text(`Contribution Frequency: ${community.settings.contributionFrequency || 'Not set'}`);
    }
    doc.moveDown();

    // Members
    doc.fontSize(14).text('Members', { underline: true });
    doc.fontSize(12).moveDown();
    
    if (community.members && community.members.length > 0) {
      community.members.forEach((member, index) => {
        doc.text(`${index+1}. ${member.user ? member.user.name : 'Unknown'} - Status: ${member.status}`);
      });
    } else {
      doc.text('No members');
    }

    // Add a footer with timestamp and URL
    doc.fontSize(10).moveDown().moveDown();
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`KoloCollect - Community ID: ${community._id}`, { align: 'center' });
    
    // Finalize the PDF and end the stream
    doc.end();

    // When the stream is finished, send the file
    stream.on('finish', () => {
      res.download(filePath, `${community.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`, (err) => {
        // Delete temporary file after sending
        fs.unlink(filePath, () => {});
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    });
  } catch (error) {
    console.error('Error generating community PDF:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate community PDF',
      error: error.message
    });
  }
};

/**
 * Generate a PDF for a contribution
 */
exports.exportContributionAsPdf = async (req, res) => {  try {
    const { id } = req.params;
    const contribution = await Contribution.findById(id)
      .populate('userId', 'name email')
      .populate('midCycleId')
      .populate({
        path: 'communityId',
        select: 'name description settings',
        populate: {
          path: 'admin',
          select: 'name email'
        }
      });

    if (!contribution) {
      return res.status(404).json({
        status: 'error',
        message: 'Contribution not found'
      });
    }

    // Create a temporary file path
    const fileName = `contribution-${id}-${uuidv4()}.pdf`;
    const filePath = path.join(__dirname, '..', 'temp', fileName);

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create PDF document
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // Add receipt header
    doc.fontSize(20).text('CONTRIBUTION RECEIPT', { align: 'center' });
    doc.moveDown();
    
    // Add a line
    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();
    doc.moveDown();

    // Add receipt details
    doc.fontSize(14).text('Contribution Details', { underline: true });
    doc.fontSize(12).moveDown();
    
    doc.text(`Receipt ID: ${contribution._id}`);
    doc.text(`Date: ${new Date(contribution.date).toLocaleString()}`);    doc.text(`Contributor: ${contribution.userId.name}`);
    doc.text(`Email: ${contribution.userId.email}`);
    doc.text(`Amount: €${contribution.amount.toFixed(2)}`);
    doc.text(`Payment Method: ${contribution.paymentMethod || 'Wallet'}`);
    doc.text(`Status: ${contribution.status || 'Completed'}`);
    doc.moveDown();

    // Community information
    if (contribution.communityId) {
      doc.fontSize(14).text('Community Information', { underline: true });
      doc.fontSize(12).moveDown();
      doc.text(`Community: ${contribution.communityId.name}`);
      doc.text(`Description: ${contribution.communityId.description || 'No description'}`);
      
      if (contribution.communityId.admin) {
        doc.text(`Admin: ${contribution.communityId.admin.name}`);
        doc.text(`Admin Email: ${contribution.communityId.admin.email}`);
      }
      doc.moveDown();
    }    // Mid-cycle information
    if (contribution.midCycleId) {
      doc.fontSize(14).text('Cycle Information', { underline: true });
      doc.fontSize(12).moveDown();
      doc.text(`Mid-Cycle ID: ${contribution.midCycleId._id}`);
      doc.text(`Mid-Cycle Status: ${contribution.midCycleId.status || 'Active'}`);
      doc.text(`Cycle Number: ${contribution.midCycleId.cycleNumber || 'Unknown'}`);
      doc.moveDown();
    }

    // Add a footer with timestamp
    doc.fontSize(10).moveDown().moveDown();
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text('This is an official receipt from KoloCollect', { align: 'center' });
    
    // Finalize the PDF and end the stream
    doc.end();

    // When the stream is finished, send the file
    stream.on('finish', () => {
      res.download(filePath, `contribution_receipt_${id}.pdf`, (err) => {
        // Delete temporary file after sending
        fs.unlink(filePath, () => {});
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    });
  } catch (error) {
    console.error('Error generating contribution PDF:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate contribution PDF',
      error: error.message
    });
  }
};

/**
 * Generate a PDF for a cycle
 */
exports.exportCycleAsPdf = async (req, res) => {
  try {
    const { communityId, cycleId } = req.params;
    const cycle = await Cycle.findById(cycleId);
    const community = await Community.findById(communityId);
    
    if (!cycle || !community) {
      return res.status(404).json({
        status: 'error',
        message: cycle ? 'Community not found' : 'Cycle not found'
      });
    }

    const midcycles = await Midcycle.find({ cycle: cycleId })
      .populate('nextInLine', 'name email');
      
    const contributions = await Contribution.find({ 
      communityId: communityId,
      midCycle: { $in: midcycles.map(m => m._id) }
    }).populate('user', 'name email');

    // Create a temporary file path
    const fileName = `cycle-${cycleId}-${uuidv4()}.pdf`;
    const filePath = path.join(__dirname, '..', 'temp', fileName);

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create PDF document
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // Add cycle header
    doc.fontSize(20).text(`CYCLE #${cycle.cycleNumber || 'Unknown'} REPORT`, { align: 'center' });
    doc.fontSize(16).text(community.name, { align: 'center' });
    doc.moveDown();
    
    // Add a line
    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();
    doc.moveDown();

    // Add cycle details
    doc.fontSize(14).text('Cycle Details', { underline: true });
    doc.fontSize(12).moveDown();
    
    doc.text(`Cycle ID: ${cycle._id}`);
    doc.text(`Start Date: ${new Date(cycle.startDate).toLocaleDateString()}`);
    doc.text(`End Date: ${cycle.endDate ? new Date(cycle.endDate).toLocaleDateString() : 'Ongoing'}`);
    doc.text(`Status: ${cycle.status || 'Active'}`);
    doc.text(`Number of Mid-Cycles: ${midcycles.length}`);
    doc.moveDown();

    // Mid-cycle information
    if (midcycles.length > 0) {
      doc.fontSize(14).text('Mid-Cycles', { underline: true });
      doc.fontSize(12).moveDown();
      
      midcycles.forEach((midcycle, index) => {
        doc.text(`Mid-Cycle ${index+1}:`);
        doc.text(`  ID: ${midcycle._id}`);
        doc.text(`  Status: ${midcycle.status}`);
        
        if (midcycle.nextInLine) {
          doc.text(`  Next in Line: ${midcycle.nextInLine.name} (${midcycle.nextInLine.email})`);
        }
        
        // Get contributions for this midcycle
        const midcycleContributions = contributions.filter(c => 
          c.midCycle && c.midCycle.toString() === midcycle._id.toString());
          
        doc.text(`  Contributions: ${midcycleContributions.length}`);
        
        // Calculate total amount
        let totalAmount = 0;
        midcycleContributions.forEach(c => totalAmount += c.amount);
        doc.text(`  Total Amount: €${totalAmount.toFixed(2)}`);
        
        doc.moveDown();
      });
    } else {
      doc.text('No mid-cycles found for this cycle.');
      doc.moveDown();
    }

    // Add a footer with timestamp
    doc.fontSize(10).moveDown().moveDown();
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`KoloCollect - Community: ${community.name}`, { align: 'center' });
    
    // Finalize the PDF and end the stream
    doc.end();

    // When the stream is finished, send the file
    stream.on('finish', () => {
      res.download(filePath, `cycle_${cycle.cycleNumber || cycleId}_report.pdf`, (err) => {
        // Delete temporary file after sending
        fs.unlink(filePath, () => {});
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    });
  } catch (error) {
    console.error('Error generating cycle PDF:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate cycle PDF',
      error: error.message
    });
  }
};

/**
 * Generate a PDF for a midcycle
 */
exports.exportMidcycleAsPdf = async (req, res) => {
  try {
    const { communityId, midcycleId } = req.params;
    const midcycle = await Midcycle.findById(midcycleId)
      .populate('nextInLine', 'name email')
      .populate('cycle');
      
    const community = await Community.findById(communityId);
    
    if (!midcycle || !community) {
      return res.status(404).json({
        status: 'error',
        message: midcycle ? 'Community not found' : 'Mid-cycle not found'
      });
    }

    const contributions = await Contribution.find({ 
      communityId: communityId,
      midCycle: midcycleId
    }).populate('user', 'name email');

    // Create a temporary file path
    const fileName = `midcycle-${midcycleId}-${uuidv4()}.pdf`;
    const filePath = path.join(__dirname, '..', 'temp', fileName);

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create PDF document
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // Add midcycle header
    doc.fontSize(20).text(`MID-CYCLE REPORT`, { align: 'center' });
    doc.fontSize(16).text(community.name, { align: 'center' });
    if (midcycle.cycle && midcycle.cycle.cycleNumber) {
      doc.fontSize(14).text(`Cycle #${midcycle.cycle.cycleNumber}`, { align: 'center' });
    }
    doc.moveDown();
    
    // Add a line
    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();
    doc.moveDown();

    // Add midcycle details
    doc.fontSize(14).text('Mid-Cycle Details', { underline: true });
    doc.fontSize(12).moveDown();
    
    doc.text(`Mid-Cycle ID: ${midcycle._id}`);
    doc.text(`Start Date: ${new Date(midcycle.startDate).toLocaleDateString()}`);
    doc.text(`End Date: ${midcycle.endDate ? new Date(midcycle.endDate).toLocaleDateString() : 'Ongoing'}`);
    doc.text(`Status: ${midcycle.status || 'Active'}`);
    
    if (midcycle.nextInLine) {
      doc.text(`Next in Line: ${midcycle.nextInLine.name} (${midcycle.nextInLine.email})`);
    }
    doc.moveDown();

    // Contributions information
    if (contributions.length > 0) {
      doc.fontSize(14).text('Contributions', { underline: true });
      doc.fontSize(12).moveDown();
      
      // Calculate total amount
      let totalAmount = 0;
      contributions.forEach(c => totalAmount += c.amount);
      doc.text(`Total Contributions: ${contributions.length}`);
      doc.text(`Total Amount: €${totalAmount.toFixed(2)}`);
      doc.moveDown();
      
      // List all contributions
      contributions.forEach((contribution, index) => {
        doc.text(`${index+1}. ${contribution.user.name} (${contribution.user.email})`);
        doc.text(`   Amount: €${contribution.amount.toFixed(2)}`);
        doc.text(`   Date: ${new Date(contribution.date).toLocaleDateString()}`);
        doc.text(`   Status: ${contribution.status}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.text('No contributions found for this mid-cycle.');
      doc.moveDown();
    }

    // Add a footer with timestamp
    doc.fontSize(10).moveDown().moveDown();
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`KoloCollect - Community: ${community.name}`, { align: 'center' });
    
    // Finalize the PDF and end the stream
    doc.end();

    // When the stream is finished, send the file
    stream.on('finish', () => {
      res.download(filePath, `midcycle_report_${midcycleId}.pdf`, (err) => {
        // Delete temporary file after sending
        fs.unlink(filePath, () => {});
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    });
  } catch (error) {
    console.error('Error generating midcycle PDF:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate midcycle PDF',
      error: error.message
    });
  }
};

/**
 * Share a community via email
 */
exports.shareCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { shareMethod, recipients } = req.body;
    
    const community = await Community.findById(id)
      .populate('admin', 'name email');
      
    if (!community) {
      return res.status(404).json({ status: 'error', message: 'Community not found' });
    }
    
    // Generate a unique share ID for tracking
    const shareId = uuidv4();
    
    // Handle different share methods
    if (shareMethod === 'email') {
      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Recipients are required for email sharing' });
      }
      
      // Create share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${id}?share=${shareId}`;
      
      // Email template
      const mailOptions = {
        from: config.email,
        to: recipients.join(','),
        subject: `Check out this community: ${community.name}`,
        html: `
          <h2>Community Invitation: ${community.name}</h2>
          <p>${req.user.name} thought you might be interested in joining this community.</p>
          <p><strong>About the community:</strong> ${community.description || 'No description available'}</p>
          <p><strong>Admin:</strong> ${community.admin ? community.admin.name : 'Unknown'}</p>
          <p><a href="${shareUrl}" style="padding: 10px 15px; background-color: #6D28D9; color: white; text-decoration: none; border-radius: 4px;">View Community</a></p>
          <p>or copy this link: ${shareUrl}</p>
          <hr>
          <p><small>This email was sent via KoloCollect. If you don't want to receive these emails, please contact the sender.</small></p>
        `
      };
      
      // Send email
      await transporter.sendMail(mailOptions);
      
      return res.status(200).json({
        status: 'success',
        message: 'Community shared via email successfully',
        data: {
          shareId,
          shareMethod,
          recipients,
          shareUrl
        }
      });
    } 
    else if (shareMethod === 'link') {
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${id}?share=${shareId}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Share link generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl
        }
      });
    }
    else if (shareMethod === 'social') {
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${id}?share=${shareId}`;
      
      // Generate social media sharing links
      const twitterUrl = `https://twitter.com/intent/tweet?text=Check out this community: ${community.name}&url=${encodeURIComponent(shareUrl)}`;
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this community: ${community.name} ${shareUrl}`)}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Social media sharing links generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl,
          socialLinks: {
            twitter: twitterUrl,
            facebook: facebookUrl,
            whatsapp: whatsappUrl
          }
        }
      });
    }
    else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid share method. Supported methods: email, link, social'
      });
    }
  } catch (error) {
    console.error('Error sharing community:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to share community',
      error: error.message
    });
  }
};

/**
 * Share a contribution receipt
 */
exports.shareContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { shareMethod, recipients } = req.body;
      const contribution = await Contribution.findById(id)
      .populate('userId', 'name email')
      .populate({
        path: 'communityId',
        select: 'name'
      });
      
    if (!contribution) {
      return res.status(404).json({ status: 'error', message: 'Contribution not found' });
    }
    
    // Generate a unique share ID for tracking
    const shareId = uuidv4();
    
    // Handle different share methods
    if (shareMethod === 'email') {
      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Recipients are required for email sharing' });
      }
      
      // Create share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/contributions/${id}?share=${shareId}`;
      
      // Email template
      const mailOptions = {
        from: config.email,
        to: recipients.join(','),
        subject: `Contribution Receipt - ${contribution.communityId ? contribution.communityId.name : 'Community'}`,
        html: `
          <h2>Contribution Receipt</h2>          <p>${req.user.name} has shared a contribution receipt with you.</p>
          <p><strong>Contributor:</strong> ${contribution.userId.name}</p>
          <p><strong>Community:</strong> ${contribution.communityId ? contribution.communityId.name : 'Unknown'}</p>
          <p><strong>Amount:</strong> €${contribution.amount.toFixed(2)}</p>
          <p><strong>Date:</strong> ${new Date(contribution.date).toLocaleDateString()}</p>
          <p><a href="${shareUrl}" style="padding: 10px 15px; background-color: #6D28D9; color: white; text-decoration: none; border-radius: 4px;">View Full Receipt</a></p>
          <p>or copy this link: ${shareUrl}</p>
          <hr>
          <p><small>This email was sent via KoloCollect. If you don't want to receive these emails, please contact the sender.</small></p>
        `
      };
      
      // Send email
      await transporter.sendMail(mailOptions);
      
      return res.status(200).json({
        status: 'success',
        message: 'Contribution shared via email successfully',
        data: {
          shareId,
          shareMethod,
          recipients,
          shareUrl
        }
      });
    } 
    else if (shareMethod === 'link') {
      const shareUrl = `${req.protocol}://${req.get('host')}/contributions/${id}?share=${shareId}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Share link generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl
        }
      });
    }
    else if (shareMethod === 'social') {
      const shareUrl = `${req.protocol}://${req.get('host')}/contributions/${id}?share=${shareId}`;
      
      // Generate social media sharing links
      const twitterUrl = `https://twitter.com/intent/tweet?text=My contribution receipt for ${contribution.communityId ? contribution.communityId.name : 'community'}&url=${encodeURIComponent(shareUrl)}`;
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`My contribution receipt for ${contribution.communityId ? contribution.communityId.name : 'community'} ${shareUrl}`)}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Social media sharing links generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl,
          socialLinks: {
            twitter: twitterUrl,
            facebook: facebookUrl,
            whatsapp: whatsappUrl
          }
        }
      });
    }
    else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid share method. Supported methods: email, link, social'
      });
    }
  } catch (error) {
    console.error('Error sharing contribution:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to share contribution',
      error: error.message
    });
  }
};

/**
 * Share a cycle
 */
exports.shareCycle = async (req, res) => {
  try {
    const { communityId, cycleId } = req.params;
    const { shareMethod, recipients } = req.body;
    
    const cycle = await Cycle.findById(cycleId);
    const community = await Community.findById(communityId);
    
    if (!cycle || !community) {
      return res.status(404).json({
        status: 'error',
        message: cycle ? 'Community not found' : 'Cycle not found'
      });
    }
    
    // Generate a unique share ID for tracking
    const shareId = uuidv4();
    
    // Handle different share methods
    if (shareMethod === 'email') {
      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Recipients are required for email sharing' });
      }
      
      // Create share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${communityId}/cycles/${cycleId}?share=${shareId}`;
      
      // Email template
      const mailOptions = {
        from: config.email,
        to: recipients.join(','),
        subject: `Cycle #${cycle.cycleNumber || 'Unknown'} - ${community.name}`,
        html: `
          <h2>Cycle Report: ${community.name}</h2>
          <p>${req.user.name} has shared a cycle report with you.</p>
          <p><strong>Community:</strong> ${community.name}</p>
          <p><strong>Cycle Number:</strong> ${cycle.cycleNumber || 'Unknown'}</p>
          <p><strong>Start Date:</strong> ${new Date(cycle.startDate).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${cycle.status || 'Active'}</p>
          <p><a href="${shareUrl}" style="padding: 10px 15px; background-color: #6D28D9; color: white; text-decoration: none; border-radius: 4px;">View Full Cycle Report</a></p>
          <p>or copy this link: ${shareUrl}</p>
          <hr>
          <p><small>This email was sent via KoloCollect. If you don't want to receive these emails, please contact the sender.</small></p>
        `
      };
      
      // Send email
      await transporter.sendMail(mailOptions);
      
      return res.status(200).json({
        status: 'success',
        message: 'Cycle shared via email successfully',
        data: {
          shareId,
          shareMethod,
          recipients,
          shareUrl
        }
      });
    } 
    else if (shareMethod === 'link') {
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${communityId}/cycles/${cycleId}?share=${shareId}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Share link generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl
        }
      });
    }
    else if (shareMethod === 'social') {
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${communityId}/cycles/${cycleId}?share=${shareId}`;
      
      // Generate social media sharing links
      const twitterUrl = `https://twitter.com/intent/tweet?text=Cycle report for ${community.name}&url=${encodeURIComponent(shareUrl)}`;
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Cycle report for ${community.name} ${shareUrl}`)}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Social media sharing links generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl,
          socialLinks: {
            twitter: twitterUrl,
            facebook: facebookUrl,
            whatsapp: whatsappUrl
          }
        }
      });
    }
    else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid share method. Supported methods: email, link, social'
      });
    }
  } catch (error) {
    console.error('Error sharing cycle:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to share cycle',
      error: error.message
    });
  }
};

/**
 * Share a mid-cycle
 */
exports.shareMidcycle = async (req, res) => {
  try {
    const { communityId, midcycleId } = req.params;
    const { shareMethod, recipients } = req.body;
    
    const midcycle = await Midcycle.findById(midcycleId)
      .populate('nextInLine', 'name email')
      .populate('cycle');
      
    const community = await Community.findById(communityId);
    
    if (!midcycle || !community) {
      return res.status(404).json({
        status: 'error',
        message: midcycle ? 'Community not found' : 'Mid-cycle not found'
      });
    }
    
    // Generate a unique share ID for tracking
    const shareId = uuidv4();
    
    // Handle different share methods
    if (shareMethod === 'email') {
      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Recipients are required for email sharing' });
      }
      
      // Create share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${communityId}/midcycles/${midcycleId}?share=${shareId}`;
      
      // Email template
      let cycleInfo = 'Unknown Cycle';
      if (midcycle.cycle && midcycle.cycle.cycleNumber) {
        cycleInfo = `Cycle #${midcycle.cycle.cycleNumber}`;
      }
      
      const mailOptions = {
        from: config.email,
        to: recipients.join(','),
        subject: `Mid-cycle Report - ${community.name} ${cycleInfo}`,
        html: `
          <h2>Mid-cycle Report: ${community.name}</h2>
          <p>${req.user.name} has shared a mid-cycle report with you.</p>
          <p><strong>Community:</strong> ${community.name}</p>
          <p><strong>Cycle:</strong> ${cycleInfo}</p>
          <p><strong>Status:</strong> ${midcycle.status || 'Active'}</p>
          ${midcycle.nextInLine ? `<p><strong>Next in Line:</strong> ${midcycle.nextInLine.name}</p>` : ''}
          <p><a href="${shareUrl}" style="padding: 10px 15px; background-color: #6D28D9; color: white; text-decoration: none; border-radius: 4px;">View Full Mid-cycle Report</a></p>
          <p>or copy this link: ${shareUrl}</p>
          <hr>
          <p><small>This email was sent via KoloCollect. If you don't want to receive these emails, please contact the sender.</small></p>
        `
      };
      
      // Send email
      await transporter.sendMail(mailOptions);
      
      return res.status(200).json({
        status: 'success',
        message: 'Mid-cycle shared via email successfully',
        data: {
          shareId,
          shareMethod,
          recipients,
          shareUrl
        }
      });
    } 
    else if (shareMethod === 'link') {
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${communityId}/midcycles/${midcycleId}?share=${shareId}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Share link generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl
        }
      });
    }
    else if (shareMethod === 'social') {
      const shareUrl = `${req.protocol}://${req.get('host')}/communities/${communityId}/midcycles/${midcycleId}?share=${shareId}`;
      
      let cycleInfo = '';
      if (midcycle.cycle && midcycle.cycle.cycleNumber) {
        cycleInfo = ` - Cycle #${midcycle.cycle.cycleNumber}`;
      }
      
      // Generate social media sharing links
      const twitterUrl = `https://twitter.com/intent/tweet?text=Mid-cycle report for ${community.name}${cycleInfo}&url=${encodeURIComponent(shareUrl)}`;
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Mid-cycle report for ${community.name}${cycleInfo} ${shareUrl}`)}`;
      
      return res.status(200).json({
        status: 'success',
        message: 'Social media sharing links generated successfully',
        data: {
          shareId,
          shareMethod,
          shareUrl,
          socialLinks: {
            twitter: twitterUrl,
            facebook: facebookUrl,
            whatsapp: whatsappUrl
          }
        }
      });
    }
    else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid share method. Supported methods: email, link, social'
      });
    }
  } catch (error) {
    console.error('Error sharing midcycle:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to share mid-cycle',
      error: error.message
    });
  }
};