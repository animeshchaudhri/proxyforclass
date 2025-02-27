const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const schedule = require('node-schedule');
require('dotenv').config()
const express = require('express');



const app = express();
const PORT = process.env.PORT || 3000;

class ProxyManager {
  constructor() {
    this.classSchedule = {
      'Monday': [
        { class: 'ADS', endTime: '10:00', location: 'TG-421 (Gaganpreet)' },
        { class: 'CC', endTime: '13:00', location: 'TG-421 (Righa)' },
        { class: 'Information Systems', endTime: '16:00', location: 'TG-421 (Sati)' }
      ],
      'Tuesday': [
        { class: 'ADS', endTime: '10:00', location: 'TG-421 (Gaganpreet)' },
        { class: 'Information Systems', endTime: '13:00', location: 'TG-421 (Sati)' },
        { class: 'Network Security', endTime: '16:00', location: 'TG-421 (Shivani)' }
      ],
      'Wednesday': [
        { class: 'ADS', endTime: '10:00', location: 'TG-421 (Gaganpreet)' },
        { class: 'Information Systems', endTime: '13:00', location: 'TG-421 (Sati)' },
        { class: 'Network Security', endTime: '16:00', location: 'TG-421 (Shivani)' }
      ],
      'Thursday': [
        { class: 'CISCO', endTime: '10:00', location: 'TG-421 (T-30)' },
        { class: 'CC', endTime: '13:00', location: 'TG-421 (Righa)' },
        { class: 'VM', endTime: '16:00', location: 'TG-421 (Gaganpreet/T-14)' }
      ],
      'Friday': [
        { class: 'CISCO', endTime: '10:00', location: 'TG-421 (T-30)' },
        { class: 'CC', endTime: '13:00', location: 'TG-421 (Righa)' },
        { class: 'VM', endTime: '16:00', location: 'TG-421 (Gaganpreet/T-14)' }
      ]
    };

    this.config = {
      friendPhone: process.env.FRIEND_PHONE,   
      message: 'Please do proxy',
      sendEarlier: 20 // Minutes before class end to send message
    };

    this.scheduleJobs = [];
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.client.on('qr', this.handleQRCode.bind(this));
    this.client.on('ready', this.handleClientReady.bind(this));
    this.client.on('auth_failure', this.handleAuthFailure.bind(this));
    this.client.on('disconnected', this.handleDisconnection.bind(this));
    
    process.on('SIGINT', this.handleShutdown.bind(this));
  }

  handleQRCode(qr) {
    console.log('QR Code received. Scan with your phone:');
    qrcode.generate(qr, { small: true });
  }

  handleClientReady() {
    console.log('Client is ready! Starting class notification bot...');
    this.sendTestMessage();
    this.scheduleTodaysMessages();
    
    schedule.scheduleJob('0 0 * * *', () => {
      console.log('New day started, scheduling today\'s messages...');
      this.clearScheduledJobs();
      this.scheduleTodaysMessages();
    });
  }

  handleAuthFailure(msg) {
    console.error('Authentication failure:', msg);
  }

  handleDisconnection(reason) {
    console.log('Client was disconnected:', reason);
  }

  async handleShutdown() {
    console.log('Shutting down...');
    this.clearScheduledJobs();
    await this.client.destroy();
    process.exit(0);
  }

  clearScheduledJobs() {
    this.scheduleJobs.forEach(job => job.cancel());
    this.scheduleJobs = [];
    console.log('Cleared all scheduled jobs');
  }

  async sendTestMessage() {
    try {
      const chatId = `${this.config.friendPhone}@c.us`;
      const testMessage = 'This is a test message from the class notification bot. If you receive this, the bot is working correctly!';
      
      await this.client.sendMessage(chatId, testMessage);
      console.log(`Test message sent at ${new Date().toLocaleTimeString()}`);
      return true;
    } catch (error) {
      console.error('Error sending test message:', error);
      return false;
    }
  }

  async sendWhatsAppMessage(className, location, customMessage = null) {
    try {
      const message = customMessage || 
                      `Hey, class ${className} at ${location} ending soon. ${this.config.message}`;
      
      const chatId = `${this.config.friendPhone}@c.us`;
      
      await this.client.sendMessage(chatId, message);
      console.log(`Message sent for ${className} at ${new Date().toLocaleTimeString()}`);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  calculateEarlierTime(timeStr) {
    const [hour, minute] = timeStr.split(':').map(Number);
    
    let newMinute = minute - this.config.sendEarlier;
    let newHour = hour;
    
    if (newMinute < 0) {
      newMinute += 60;
      newHour -= 1;
      if (newHour < 0) {
        newHour += 24;
      }
    }
    
    return {
      hour: newHour,
      minute: newMinute
    };
  }

  scheduleTodaysMessages() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    if (this.classSchedule[today]) {
      console.log(`Scheduling messages for ${today}`);
      
      this.classSchedule[today].forEach(classInfo => {
        const earlierTime = this.calculateEarlierTime(classInfo.endTime);
        
        const job = schedule.scheduleJob(`${earlierTime.minute} ${earlierTime.hour} * * *`, async () => {
          console.log(`Time to send message for ${classInfo.class} (${this.config.sendEarlier} minutes before ${classInfo.endTime})`);
          await this.sendWhatsAppMessage(classInfo.class, classInfo.location);
        });
        
        this.scheduleJobs.push(job);
        console.log(`Scheduled message for ${classInfo.class} at ${earlierTime.hour}:${earlierTime.minute.toString().padStart(2, '0')}`);
      });
    } else {
      console.log(`No classes scheduled for ${today}`);
    }
  }

  scheduleTestMessage(hour, minute) {
    console.log(`Scheduling test message for ${hour}:${minute}`);
    
    const job = schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
      console.log(`Sending test message at scheduled time ${hour}:${minute}`);
      await this.sendTestMessage();
    });
    
    this.scheduleJobs.push(job);
    return job;
  }
  
  scheduleCustomMessage(hour, minute, message) {
    console.log(`Scheduling custom message for ${hour}:${minute}`);
    
    const job = schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
      console.log(`Sending custom message at scheduled time ${hour}:${minute}`);
      await this.sendWhatsAppMessage("Custom", "N/A", message);
    });
    
    this.scheduleJobs.push(job);
    return job;
  }

  updateConfig(newConfig) {
    this.config = {...this.config, ...newConfig};
    console.log('Configuration updated:', this.config);
  }

  updateClassSchedule(day, newSchedule) {
    if (this.classSchedule[day]) {
      this.classSchedule[day] = newSchedule;
      console.log(`Schedule for ${day} updated`);
      
      // Reschedule if it's the current day
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      if (today === day) {
        this.clearScheduledJobs();
        this.scheduleTodaysMessages();
      }
    } else {
      console.error(`Invalid day: ${day}`);
    }
  }

  start() {
    this.client.initialize();
    console.log('Proxy Manager initialized');
  }
}

// Create and start the proxy manager
const proxyManager = new ProxyManager();
proxyManager.start();

// Basic routes for health check
app.get('/', (req, res) => {
  res.send('WhatsApp Proxy Bot is running!');
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    startedAt: proxyManager.startTime,
    scheduledJobs: proxyManager.scheduleJobs.length
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});