'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

module.exports.runTests = (wit) => {
  const log = wit.log;
  const Wit = wit.Wit;
  const interactive = wit.interactive;

  describe('logger', () => {
    let loggerStub;

    it('tests log flags', () => {
      expect(log.DEBUG).to.be.equal('debug');
      expect(log.INFO).to.be.equal('info');
      expect(log.WARN).to.be.equal('warn');
      expect(log.ERROR).to.be.equal('error');
    });

    it('tests logger (DEBUG)', () => {
      const logger = new log.Logger(log.DEBUG);
      loggerStub = sinon.stub(logger, 'info').returns(Promise.resolve());
      logger.info('one', 'two', 'three');
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.thisValues[0].level).to.be.equal('debug');
      expect(loggerStub.calledWith('one', 'two', 'three')).to.be.true;
    });

    it('tests logger (INFO)', () => {
      const logger = new log.Logger(log.INFO);
      loggerStub = sinon.stub(logger, 'info').returns(Promise.resolve());
      logger.info('one', 'two', 'three');
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.thisValues[0].level).to.be.equal('info');
      expect(loggerStub.calledWith('one', 'two', 'three')).to.be.true;
    });

    it('tests logger (WARN)', () => {
      const logger = new log.Logger(log.WARN);
      loggerStub = sinon.stub(logger, 'info').returns(Promise.resolve());
      logger.info('one', 'two', 'three');
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.thisValues[0].level).to.be.equal('warn');
      expect(loggerStub.calledWith('one', 'two', 'three')).to.be.true;
    });

    it('tests logger (ERROR)', () => {
      const logger = new log.Logger(log.ERROR);
      loggerStub = sinon.stub(logger, 'info').returns(Promise.resolve());
      logger.info('one', 'two', 'three');
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.thisValues[0].level).to.be.equal('error');
      expect(loggerStub.calledWith('one', 'two', 'three')).to.be.true;
    });
  });

  describe('Wit', () => {
    let client = new Wit({
      accessToken: process.env.WIT_TOKEN
    });

    it('tests that Wit has correct functions', () => {
      const witFunctions = Object.keys(client);
      expect(witFunctions).to.eql(['config', '_sessions', 'message', 'converse', 'runActions']);
    });

    it('tests message', () => {
      return client.message('Hello', {})
        .then((data) => {
          expect(data.entities.intent[0].value).to.be.equal('greet');
          expect(data._text).to.be.equal('Hello');
        });
    });

    it('tests converse', () => {
      return client.converse(`session-${Date.now()}`, 'Hello', {})
        .then((data) => {
          expect(data.entities.intent[0].value).to.be.equal('greet');
          expect(data.msg).to.be.equal('Hello to you too!');
        });
    });

    it('tests runActions', () => {
      const actions = {
        send: (request, response) => new Promise((resolve) => {
          expect(request.entities.intent[0].value).to.be.equal('greet');
          expect(request.text).to.be.equal('Hello');
          expect(response.text).to.be.equal('Hello to you too!');
          resolve();
        })
      };
      client = new Wit({
        accessToken: process.env.WIT_TOKEN,
        actions
      });
      return client.runActions(`session-${Date.now()}`, 'Hello', {}, 2);
    });
  });

  describe('interactive', () => {
    it('checks that interactive exists', () => {
      expect(interactive).to.exists;
    });
  });
};
