'use strict';

var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , datetime = require('chai-datetime')
  , config = require(__dirname + '/../config/config')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('update', function() {
    beforeEach(function () {
      this.User = this.sequelize.define('User', {
        username: { type: DataTypes.STRING },
        uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
        uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
        touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        aNumber: { type: DataTypes.INTEGER },
        bNumber: { type: DataTypes.INTEGER },
        aDate: { type: DataTypes.DATE },

        validateTest: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {isInt: true}
        },
        validateCustom: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {len: {msg: 'Length failed.', args: [1, 20]}}
        },

        dateAllowNullTrue: {
          type: DataTypes.DATE,
          allowNull: true
        }
      });
      return this.User.sync({ force: true });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING });

          User.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              sequelize.transaction().then(function(t) {
                user.update({ username: 'bar' }, { transaction: t }).success(function() {
                  User.all().success(function(users1) {
                    User.all({ transaction: t }).success(function(users2) {
                      expect(users1[0].username).to.equal('foo');
                      expect(users2[0].username).to.equal('bar');
                      t.rollback().success(function() { done(); });
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should update fields that are not specified on create', function() {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

     return User.sync({force: true}).then(function() {
        return User.create({
          name: 'snafu',
          email: 'email'
        }, {
          fields: ['name', 'email']
        }).then(function(user) {
          return user.updateAttributes({bio: 'swag'});
        }).then(function(user) {
          return user.reload();
        }).then(function(user) {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
          expect(user.get('bio')).to.equal('swag');
        });
      });
    });

    it('updates attributes in the database', function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        expect(user.username).to.equal('user');
        user.update({ username: 'person' }).success(function(user) {
          expect(user.username).to.equal('person');
          done();
        });
      });
    });

    it('ignores unknown attributes', function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.update({ username: 'person', foo: 'bar'}).success(function(user) {
          expect(user.username).to.equal('person');
          expect(user.foo).not.to.exist;
          done();
        });
      });
    });

    it("doesn't update primary keys or timestamps", function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: {type: DataTypes.STRING, primaryKey: true}
      });

      User.sync({ force: true }).success(function() {
        User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).success(function(user) {
          var oldCreatedAt = user.createdAt
            , oldUpdatedAt = user.updatedAt
            , oldIdentifier = user.identifier;

          setTimeout(function() {
            user.update({
              name: 'foobar',
              createdAt: new Date(2000, 1, 1),
              identifier: 'another identifier'
            }).success(function(user) {
              expect(new Date(user.createdAt)).to.equalDate(new Date(oldCreatedAt));
              expect(new Date(user.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
              expect(user.identifier).to.equal(oldIdentifier);
              done();
            });
          }, 1000);
        });
      });
    });

    it('uses primary keys in where clause', function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: {type: DataTypes.STRING, primaryKey: true}
      });

      User.sync({ force: true }).success(function() {
        User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).success(function(user) {
          var emitter = user.update({name: 'foobar'});
          emitter.on('sql', function(sql) {
            expect(sql).to.match(/WHERE [`"]identifier[`"]..identifier./);
            done();
          });
        });
      });
    });

    it('stores and restores null values', function(done) {
      var Download = this.sequelize.define('download', {
        startedAt: DataTypes.DATE,
        canceledAt: DataTypes.DATE,
        finishedAt: DataTypes.DATE
      });

      Download.sync().success(function() {
        Download.create({
          startedAt: new Date()
        }).success(function(download) {
          expect(download.startedAt instanceof Date).to.be.true;
          expect(download.canceledAt).to.not.be.ok;
          expect(download.finishedAt).to.not.be.ok;

          download.update({
            canceledAt: new Date()
          }).success(function(download) {
            expect(download.startedAt instanceof Date).to.be.true;
            expect(download.canceledAt instanceof Date).to.be.true;
            expect(download.finishedAt).to.not.be.ok;

            Download.all({
              where: (dialect === 'postgres' || dialect === 'mssql' ? '"finishedAt" IS NULL' : '`finishedAt` IS NULL')
            }).success(function(downloads) {
              downloads.forEach(function(download) {
                expect(download.startedAt instanceof Date).to.be.true;
                expect(download.canceledAt instanceof Date).to.be.true;
                expect(download.finishedAt).to.not.be.ok;
                done();
              });
            });
          });
        });
      });
    });
  });
});