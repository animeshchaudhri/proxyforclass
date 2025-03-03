const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const schedule = require('node-schedule');
require('dotenv').config();
const express = require('express');
const moment = require('moment-timezone'); 

const app = express();
const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata'; 

class ProxyManager {
  constructor() {
    this.startTime = new Date();
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
      sendEarlier: 20, 
      timezone: TIMEZONE
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
      const chatId = `${process.env.MY_NUMBER}@c.us`;
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
    
    const today = moment().tz(this.config.timezone).format('dddd');
    
    if (this.classSchedule[today]) {
      console.log(`Scheduling messages for ${today} in timezone ${this.config.timezone}`);
      
      this.classSchedule[today].forEach(classInfo => {
        const earlierTime = this.calculateEarlierTime(classInfo.endTime);
        
        
        const rule = new schedule.RecurrenceRule();
        rule.hour = earlierTime.hour;
        rule.minute = earlierTime.minute;
        rule.tz = this.config.timezone;
        
        const job = schedule.scheduleJob(rule, async () => {
          console.log(`Time to send message for ${classInfo.class} (${this.config.sendEarlier} minutes before ${classInfo.endTime})`);
          await this.sendWhatsAppMessage(classInfo.class, classInfo.location);
        });
        
        this.scheduleJobs.push(job);
        console.log(`Scheduled message for ${classInfo.class} at ${earlierTime.hour}:${earlierTime.minute.toString().padStart(2, '0')} ${this.config.timezone}`);
      });
    } else {
      console.log(`No classes scheduled for ${today}`);
    }
  }

  scheduleTestMessage(hour, minute) {
    console.log(`Scheduling test message for ${hour}:${minute} ${this.config.timezone}`);
    
    const rule = new schedule.RecurrenceRule();
    rule.hour = hour;
    rule.minute = minute;
    rule.tz = this.config.timezone;
    
    const job = schedule.scheduleJob(rule, async () => {
      console.log(`Sending test message at scheduled time ${hour}:${minute} ${this.config.timezone}`);
      await this.sendTestMessage();
    });
    
    this.scheduleJobs.push(job);
    return job;
  }
  
  scheduleCustomMessage(hour, minute, message) {
    console.log(`Scheduling custom message for ${hour}:${minute} ${this.config.timezone}`);
    
    const rule = new schedule.RecurrenceRule();
    rule.hour = hour;
    rule.minute = minute;
    rule.tz = this.config.timezone;
    
    const job = schedule.scheduleJob(rule, async () => {
      console.log(`Sending custom message at scheduled time ${hour}:${minute} ${this.config.timezone}`);
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
      
      
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      if (today === day) {
        this.clearScheduledJobs();
        this.scheduleTodaysMessages();
      }
    } else {
      console.error(`Invalid day: ${day}`);
    }
  }

 
  getCurrentTimeInfo() {
    return {
      serverTime: new Date().toString(),
      localTime: moment().tz(this.config.timezone).toString(),
      timezone: this.config.timezone,
      timezoneOffset: moment().tz(this.config.timezone).format('Z')
    };
  }

  start() {
    this.client.initialize();
    console.log('Proxy Manager initialized');
  }
}


const proxyManager = new ProxyManager();
proxyManager.start();

app.get('/', (req, res) => {
  res.send('WhatsApp Proxy Bot is running!');
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    startedAt: proxyManager.startTime,
    scheduledJobs: proxyManager.scheduleJobs.length,
    timeInfo: proxyManager.getCurrentTimeInfo()
  });
});

// New API endpoints for sending test messages
app.use(express.json());
// app.use(cors(*));

app.post('/api/send-test-message', async (req, res) => {
  try {
    const success = await proxyManager.sendTestMessage();
    if (success) {
      res.status(200).json({ success: true, message: 'Test message sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send test message' });
    }
  } catch (error) {
    console.error('Error in /api/send-test-message endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

app.post('/api/send-custom-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message body is required' });
    }
    
    const success = await proxyManager.sendWhatsAppMessage("Custom", "N/A", message);
    
    if (success) {
      res.status(200).json({ success: true, message: 'Custom message sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send custom message' });
    }
  } catch (error) {
    console.error('Error in /api/send-custom-message endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

app.post('/api/schedule-message', async (req, res) => {
  try {
    const { hour, minute, message } = req.body;
    
    if (hour === undefined || minute === undefined || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hour, minute, and message are required' 
      });
    }
    
    const job = proxyManager.scheduleCustomMessage(parseInt(hour), parseInt(minute), message);
    
    res.status(200).json({ 
      success: true, 
      message: `Message scheduled for ${hour}:${minute} ${proxyManager.config.timezone}`,
      scheduledTime: `${hour}:${minute}`,
      timezone: proxyManager.config.timezone
    });
  } catch (error) {
    console.error('Error in /api/schedule-message endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Current time in ${TIMEZONE}: ${moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}`);
});