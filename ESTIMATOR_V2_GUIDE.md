# Estimator V2 - Formula-Based Estimating Engine

## ✅ What V2 Has (Formula-Based Like Your Excel)

### 1. **Property Measurements Section**
Enter once, formulas reference throughout:
- Total Turf (sqft)
- Total Bed Area (sqft)
- Color Bed Area (sqft)
- Walk/Concrete (LF)
- Tree Count

**Like your Excel:** `='Property Profile'!B18`

### 2. **Production-Rate Based Calculations**
```
Hours Needed = Property Measurement ÷ Production Rate

Example:
60" Mower: 100,000 sqft ÷ 35,000 sqft/hr = 2.86 hours
```

**Like your Excel:** `='Property Profile'!B18/B5`

### 3. **Formula Engine - Live Recalculation**
Change property sqft → Hours recalculate → Cost per visit recalculates → Annual total recalculates

**Cascading formulas just like Excel**

### 4. **Flexible Unit System**
- Click "Manage Units" button
- Add custom units (yards, flats, cubic yards, etc.)
- Delete units you don't need
- Services can use any unit type

**Units Available:**
- Square Feet (sqft)
- Sqft per Hour (sqft/hr) - for production rates
- Linear Feet (LF)
- Hours (hrs)
- Per Visit (/visit)
- Per Year (/year)
- Flats (flats)
- Cubic Yards (cu yd)

### 5. **Service Types Supported**

**Type A: Production-Rate Based (like 60" Mower)**
- Has production rate (e.g., 35,000 sqft/hr)
- Pulls from property measurement
- Calculates hours needed automatically
- Rate per hour → Cost per visit

**Type B: Direct Rate Based (like Edging)**
- No production rate
- Uses measurement directly (5,000 LF × $0.05/LF)
- Cost per visit calculated

**Type C: Flat Fee Based**
- No production, no measurement
- Just enter flat rate per visit

### 6. **Category Subtotals**
- Click arrow to expand/collapse categories
- Each category shows total of selected services
- Grand total at bottom
- Monthly payment shown

### 7. **Compact, Functional UI**
All key data in one view:
- Service name
- Production rate
- Hours calculated
- Rate
- Visits/year
- Cost per visit
- Annual total

---

## 🧪 Test It Now

### Access the V2 Estimator:
```bash
cd /path/to/your/XRM
npm start
```

Navigate to: **http://localhost:3000/estimator-v2**

Or click **"⚡ Estimator V2"** in the sidebar

---

## 🎯 How to Use It

### Step 1: Enter Property Measurements
1. Fill in Total Turf sqft (default: 100,000)
2. Fill in other measurements
3. **Watch services recalculate automatically**

### Step 2: Select Services
1. Check boxes for services you want
2. Services turn blue when selected
3. Category totals update
4. Grand total updates

### Step 3: Adjust Production Rates
1. See "Production Rate" column
2. Edit production rate (e.g., change 60" mower from 35,000 to 40,000 sqft/hr)
3. **Hours column recalculates automatically**
4. **Cost per visit recalculates**
5. **Annual total recalculates**

### Step 4: Adjust Rates
1. Edit "Rate" column
2. Changes affect cost per visit
3. Annual total updates

### Step 5: Adjust Visits Per Year
1. Edit "Visits/Yr" column
2. Annual total = Cost per visit × Visits

### Step 6: Manage Custom Units
1. Click "Manage Units" button
2. Add new unit types
3. Edit abbreviations
4. Delete units you don't need

---

## 🔬 Test Scenarios

### Scenario 1: Change Property Size
1. Change Total Turf from 100,000 to 150,000
2. **Watch 60" Mower hours change from 2.86 to 4.29**
3. **Watch cost per visit increase**
4. **Watch annual total increase**
5. **Watch category subtotal increase**
6. **Watch grand total increase**

### Scenario 2: Compare Mower Options
1. Check 21" Mower box (10,000 sqft/hr production)
2. Check 36" Mower box (20,000 sqft/hr production)
3. Check 60" Mower box (35,000 sqft/hr production)
4. **See different hours needed for each**
5. **See different costs for same property**

### Scenario 3: Add Custom Service
Currently you can't add services in UI (coming next), but you can see how existing services work with the formula engine.

---

## 📊 What the Columns Mean

| Column | What It Does | Example |
|--------|--------------|---------|
| **Service** | Name of service | 60" Mower |
| **Production Rate** | How fast (sqft/hr, LF/hr, etc.) | 35,000 sqft/hr |
| **Hours** | **CALCULATED**: Measurement ÷ Production | 2.86 hrs |
| **Rate** | $/unit (hour, visit, LF, etc.) | $125 |
| **Visits/Yr** | Frequency | 38 |
| **$/Visit** | **CALCULATED**: Hours × Rate (or Measurement × Rate) | $357.50 |
| **Annual** | **CALCULATED**: $/Visit × Visits/Yr | $13,585 |

---

## ⚡ What Makes V2 Different

### V1 Demo:
- ❌ No property measurements
- ❌ No production rates
- ❌ Manual hours entry
- ❌ No formula engine
- ❌ Fixed units

### V2:
- ✅ Property measurements section
- ✅ Production-rate calculations
- ✅ **Automatic hours calculation**
- ✅ **Formula engine (change one thing, everything recalculates)**
- ✅ **Custom unit system**
- ✅ **Matches your Excel workflow**

---

## 🚧 What's Still Missing (The Final 30%)

### 1. Master Rate Card (placeholder exists)
- Define central rates
- Services pull from rate card
- Change rate card → All services update

### 2. Service Templates
- Pre-built service packages
- One-click to load "Full Maintenance Package"

### 3. Multiple Mower Selection Logic
- Radio buttons for mower options (pick ONE, not all)
- Mutually exclusive choices

### 4. Add/Delete Services in UI
- Currently services are hardcoded
- Need UI to add custom services

### 5. Multiple Sheets/Tabs
- Like your Excel with Maintenance, Landscaping, Irrigation, Agronomy tabs
- Keep estimator focused, not overwhelming

### 6. Save/Load Estimates
- Save estimate to database
- Load previous estimates

### 7. PDF Generation
- Export formatted proposal
- Include property info, services, pricing

---

## 🎯 Your Feedback Needed

Test the v2 and tell me:

1. **Does the formula engine work right?**
   - Change property sqft → Does everything recalculate?
   - Change production rate → Do hours update?

2. **Is the UI more functional?**
   - Can you see all the data you need?
   - Is it less "bulky boxes" and more "tight workflow"?

3. **What's still wrong?**
   - What columns are missing?
   - What calculations are off?
   - What workflow steps can't you do?

4. **Priority for the final 30%?**
   - Master rate card?
   - Add/delete services?
   - Multiple choice logic (pick 21" OR 60", not both)?
   - Something else?

---

## 🔧 Technical Notes

### Formula Engine Logic:
```javascript
// Hours calculation (production-based)
Hours = PropertyMeasurement / ProductionRate

// Cost per visit (hourly)
CostPerVisit = Hours × HourlyRate

// Cost per visit (per unit)
CostPerVisit = Measurement × RatePerUnit

// Annual total
AnnualTotal = CostPerVisit × VisitsPerYear

// Category total
CategoryTotal = Sum of all selected services in category

// Grand total
GrandTotal = Sum of all category totals
```

### React State Structure:
```javascript
propertyMeasurements: {
  totalTurfSqft: 100000,
  totalBedSqft: 20000,
  // ...
}

categories: [
  {
    name: 'Mowing Services',
    services: [
      {
        name: '60" Mower',
        productionRate: 35000,
        measurementSource: 'totalTurfSqft',
        // Formulas calculate the rest
      }
    ]
  }
]
```

---

## 🚀 Next Steps

1. **Test v2** → Tell me what's wrong
2. **I'll fix** → The calculations, UI, workflow
3. **Add final 30%** → Master rates, add/delete services, etc.
4. **Integrate** → Replace old estimator with v2

**This is closer to your Excel workflow. But I need your feedback on what's still off before building the final 30%.**
