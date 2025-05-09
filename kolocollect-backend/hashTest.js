const bcrypt = require('bcryptjs');

// Step 1: Hash the initial plain password and store it
const initialPlainPassword = "password123";

bcrypt.hash(initialPlainPassword, 10, (err, storedHashedPassword) => {
    if (err) throw err;

    console.log('Stored Hashed Password:', storedHashedPassword);

    // Step 2: Extract the salt from the stored hashed password
    const extractedSalt = storedHashedPassword.substring(0, 29); // Extract the salt from the hash

    // Step 3: Hash the plain password again using the extracted salt
    bcrypt.hash(initialPlainPassword, extractedSalt, (err, manuallyHashedPassword) => {
        if (err) throw err;

        console.log('Manually Hashed Password with extracted salt:', manuallyHashedPassword);

        // Step 4: Compare the manually hashed password with the stored hashed password
        const isMatch = manuallyHashedPassword === storedHashedPassword;
        console.log('Password Match:', isMatch); // Should return true if they match
    });
});
