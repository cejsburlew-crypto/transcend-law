// Twilio Video Integration

import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const twilioIntegration = {
  // Create video room
  createVideoRoom: async (roomName: string) => {
    try {
      const room = await twilioClient.video.rooms.create({
        uniqueName: roomName,
        type: 'group',
        maxParticipants: 2,
      });
      return { success: true, roomSid: room.sid, roomName: room.uniqueName };
    } catch (error) {
      console.error('Twilio room error:', error);
      return { success: false, error: 'Failed to create room' };
    }
  },

  // Generate access token for video room
  generateAccessToken: (identity: string, roomName: string) => {
    try {
      // The SDK requires the identity in the constructor options.
      const token = new twilio.jwt.AccessToken(
        process.env.TWILIO_ACCOUNT_SID || '',
        process.env.TWILIO_API_KEY || '',
        process.env.TWILIO_API_SECRET || '',
        { identity }
      );
      const videoGrant = new twilio.jwt.AccessToken.VideoGrant({ room: roomName });
      token.addGrant(videoGrant);
      return { success: true, token: token.toJwt() };
    } catch (error) {
      console.error('Token generation error:', error);
      return { success: false, error: 'Failed to generate token' };
    }
  },

  // Disconnect room
  disconnectRoom: async (roomSid: string) => {
    try {
      await twilioClient.video.rooms(roomSid).update({ status: 'completed' });
      return { success: true };
    } catch (error) {
      console.error('Room disconnect error:', error);
      return { success: false, error: 'Failed to disconnect room' };
    }
  },
};
