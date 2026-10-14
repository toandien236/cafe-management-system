// Starter inventory based on the app's 1–12 guest form limit.
// Update this list to match the cafe's actual floor plan before production use.
module.exports = Object.freeze({
  reservationDurationMinutes: 120,
  tables: Object.freeze([
    ...['01', '02', '03', '04'].map(tableNumber => Object.freeze({ tableNumber, capacity: 2 })),
    ...['05', '06', '07', '08'].map(tableNumber => Object.freeze({ tableNumber, capacity: 4 })),
    ...['09', '10'].map(tableNumber => Object.freeze({ tableNumber, capacity: 6 })),
    Object.freeze({ tableNumber: '11', capacity: 8 }),
    Object.freeze({ tableNumber: '12', capacity: 12 }),
    ...['13', '14', '15', '16', '17', '18', '19', '20']
      .map(tableNumber => Object.freeze({ tableNumber, capacity: 4 }))
  ])
});
