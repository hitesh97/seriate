var sql = seriateFactory();
var config = require( "./local-config.json" );
var getRowId = ( function() {
	var _id = 0;
	return function() {
		return _id++;
	};
}() );

describe( "Seriate Integration Tests", function() {
	before( function( done ) {
		this.timeout( 20000 );
		sql.getPlainContext( config )
			.step( "DropDatabase", {
				query: "if db_id('tds_node_test') is not null drop database tds_node_test"
			} )
			.step( "CreateDatabase", {
				query: "create database tds_node_test"
			} )
			.step( "CreateTable", {
				query: "create table tds_node_test..NodeTestTable (bi1 bigint not null identity(1,1) primary key, v1 varchar(255), i1 int null)"
			} ).step( "CreateSecondTable", {
			query: "create table tds_node_test..NodeTestTableNoIdent (bi1 bigint not null primary key, v1 varchar(255), i1 int null)"
		} )
			.end( function() {
				done();
			} )
			.error( function( err ) {
				console.log( err );
			} );
	} );

	describe( "When executing within a TransactionContext", function() {
		describe( "and committing the transaction", function() {
			var id, context, insError, insResult, resultsCheck, checkError, readCheck;
			before( function( done ) {
				id = getRowId();
				readCheck = function( done ) {
					sql.execute( config, {
						preparedSql: "select * from tds_node_test..NodeTestTable where i1 = @i1",
						params: {
							i1: {
								val: id,
								type: sql.INT
							}
						}
					} ).then( function( res ) {
						resultsCheck = res;
						done();
					}, function( err ) {
							checkError = err;
							done();
						} );
				};
				context = sql
					.getTransactionContext( config )
					.step( "insert", {
						preparedSql: "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1); select SCOPE_IDENTITY() AS NewId;",
						params: {
							i1: {
								val: id,
								type: sql.INT
							},
							v1: {
								val: "testy",
								type: sql.NVARCHAR
							}
						}
					} )
					.end( function( res ) {
						insResult = res;
						res.transaction
							.commit()
							.then( function() {
								readCheck( done );
							} );
					} )
					.error( function( err ) {
						insError = err;
						done();
					} );
			} );
			it( "should have return inserted row", function() {
				resultsCheck.length.should.equal( 1 );
				( typeof checkError ).should.equal( "undefined" );
			} );
			it( "should have returned the identity of inserted row", function() {
				insResult.sets.insert[ 0 ].NewId.should.be.ok;
				( typeof insResult.sets.insert[ 0 ].NewId ).should.equal( "number" );
			} );
		} );
		describe( "and rolling back the transaction", function() {
			var id, context, insError, readCheck, resultsCheck, checkError;
			before( function( done ) {
				id = getRowId();
				readCheck = function( done ) {
					sql.execute( config, {
						preparedSql: "select * from tds_node_test..NodeTestTable where i1 = @i1",
						params: {
							i1: {
								val: id,
								type: sql.INT
							}
						}
					} ).then( function( res ) {
						resultsCheck = res;
						done();
					}, function( err ) {
							checkError = err;
							done();
						} );
				};
				context = sql
					.getTransactionContext( config )
					.step( "insert", {
						preparedSql: "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1)",
						params: {
							i1: {
								val: id,
								type: sql.INT
							},
							v1: {
								val: "testy",
								type: sql.NVARCHAR
							}
						}
					} )
					.end( function( res ) {
						res.transaction
							.rollback()
							.then( function() {
								readCheck( done );
							} );
					} )
					.error( function( err ) {
						insError = err;
						done();
					} );
			} );
			it( "should show that the row was not inserted", function() {
				resultsCheck.length.should.equal( 0 );
				( typeof checkError ).should.equal( "undefined" );
			} );
		} );
	} );
	describe( "When updating a row", function() {
		var id, insertCheck, insResults, updateCmd, updateErr, updateCheck, updResults;
		before( function( done ) {
			id = getRowId();
			insertCheck = function( done ) {
				sql.execute( config, {
					preparedSql: "select * from tds_node_test..NodeTestTable where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					insResults = res;
					done();
				} );
			};
			updateCheck = function( done ) {
				sql.execute( config, {
					preparedSql: "select * from tds_node_test..NodeTestTable where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					updResults = res;
					done();
				} );
			};
			updateCmd = function( done ) {
				sql.execute( config, {
					preparedSql: "update tds_node_test..NodeTestTable set v1 = @v1 where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						},
						v1: {
							val: "updatey",
							type: sql.NVARCHAR
						}
					}
				} ).then( function() {
					updateCheck( done );
				}, function( err ) {
						updateErr = err;
					} );
			};
			sql.execute( config, {
				preparedSql: "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1)",
				params: {
					i1: {
						val: id,
						type: sql.INT
					},
					v1: {
						val: "inserty",
						type: sql.NVARCHAR
					}
				}
			} ).then( function() {
				insertCheck( done );
			} );
		} );

		it( "should have inserted the row", function() {
			insResults.length.should.equal( 1 );
		} );
		it( "should show the updates", function( done ) {
			updateCmd( function() {
				updResults[ 0 ].v1.should.equal( "updatey" );
				done();
			} );
		} );
	} );
	describe( "When using default connection configuration option", function() {
		it( "Should utilize default options", function( done ) {
			sql.setDefaultConfig( config );
			sql.execute( {
				preparedSql: "select * from tds_node_test..NodeTestTable where i1 = @i1",
				params: {
					i1: {
						val: getRowId(),
						type: sql.INT
					}
				}
			} ).then( function( /* res */ ) {
				done();
			} );
		} );
	} );
} );
