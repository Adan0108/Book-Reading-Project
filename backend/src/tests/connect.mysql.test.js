const mysql = require('mysql2');

//create connection to pool server

const pool = mysql.createPool({
  host: "localhost",
  user: "adan",
  password: "123456", 
  database: "E-Commerce",
})

const batchSize = 1000000; //number of records to insert at once (adjust as needed)
const totalSize = 10000000 //adjust as needed

let currentId = 1;

console.time('::::::::::::TIMER:::::::::::::')
const insertPatch = async() =>{
  const values = [] //array to hold the values to be inserted
  for (let i = 0; i < batchSize && currentId <= totalSize; i++){
    const name = `name-${currentId}`
    const age = currentId
    const address = `address-${currentId}`
    values.push([currentId,name, age, address])
    currentId++
  }

  if(!values.length)
  {
    console.timeEnd('::::::::::::TIMER:::::::::::::')
    pool.end(err => {
      if (err) {
        console.error('Error closing the pool:', err);
      } else {
        console.log('Pool closed successfully.');
      }
    })
    return
  }
  const sql = `INSERT INTO test_table (id, name, age, address) VALUES ?` //use ? to insert multiple values
  
  pool.query(sql, [values], async function(err, results) {
    if (err) throw err; 
    console.log(`Inserted ${results.affectedRows} rows`);
    await insertPatch() //call the function again to insert the next batch
  })
}

insertPatch().catch(console.error) //call the function to start inserting data



//perform a sample  operation to test the connection
// pool.query('SELECT * from users', function (error, results, fields) {
//   if (error) throw error;

//   console.log('query result: ', results); // 2
//   pool.end(err => {
//     if (err) {
//       console.error('Error closing the pool:', err);
//     } else {
//       console.log('Pool closed successfully.');
//     }
//   })
// })
