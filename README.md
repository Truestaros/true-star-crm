# True Star Outdoor Solutions - Commercial Landscape CRM

A comprehensive CRM system designed specifically for commercial landscape maintenance businesses.

## Features

### 1. **Service Catalog Management**
- Pre-loaded with industry-standard services (mowing, fertilization, irrigation, etc.)
- Editable pricing formulas based on measurements
- Customizable service categories
- Add/edit/delete services as needed

### 2. **Professional Bid Generator**
- Input property measurements (sq ft, shrub count, etc.)
- Auto-calculate pricing based on service catalog
- Manual price adjustments for competitive bidding
- Generate professional PDF proposals
- Save bids to leads for tracking

### 3. **Sales Pipeline Manager**
- Visual kanban-style pipeline board
- Customizable deal stages
- Track estimated contract values
- Monitor 50+ leads simultaneously
- Follow-up date tracking
- Stage-by-stage value reporting

### 4. **Data Persistence**
- All data stored locally in browser (localStorage)
- Automatic saving
- No login required
- Works offline

## Getting Started

### Installation

```bash
# Navigate to the project directory
cd landscape-crm

# Install dependencies
npm install

# Start the development server
npm start
```

The application will open at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## How to Use

### Setting Up Your Service Catalog

1. Navigate to **Service Catalog** tab
2. Review pre-loaded services (based on industry standards)
3. Edit pricing to match your cost structure:
   - Click the edit icon on any service
   - Adjust base price, frequency, or description
   - Click save
4. Add custom services using the "Add Service" button

### Creating a Bid/Proposal

1. Navigate to **Create Bid** tab
2. Optional: Select an existing lead from the dropdown
3. Fill in customer and property information
4. Enter property measurements:
   - Irrigated turf area (sq ft)
   - Shrub counts
   - Color bed area
   - Etc.
5. Add services from your catalog
6. Adjust quantities and pricing as needed
7. Review calculated totals
8. Generate PDF proposal
9. Save to lead for tracking

### Managing Your Pipeline

1. Navigate to **Pipeline** tab
2. Click **Add Lead** to create a new opportunity
3. Fill in:
   - Company name and contact
   - Property details
   - Estimated contract value
   - Initial stage
   - Follow-up date
4. Drag leads between stages or use the dropdown
5. Edit/delete leads as needed
6. View totals by stage and overall pipeline value

### Customizing Pipeline Stages

1. Navigate to **Settings** tab
2. Edit existing stages or add new ones
3. Remove stages you don't need
4. Changes apply immediately to your pipeline

## Key Formulas

### Pricing Calculations

- **Cost per Occurrence** = Base Price × Quantity
- **Annual Cost** = Cost per Occurrence × Frequency
- **Sales Tax** = Annual Total × 8.25% (Texas)
- **Monthly Payment** = (Annual Total + Tax) ÷ 12

### Example Services

| Service | Base Price | Unit | Annual Frequency |
|---------|------------|------|------------------|
| Irrigated Turf Mow | $2.50 | per 1000 sq ft | 36 visits |
| Shrub Pruning | $15.00 | per shrub | 8 visits |
| Fertilization | $1.00 | per 1000 sq ft | 3 applications |

## Data Management

### Backup Your Data

Your data is stored in browser localStorage. To backup:

1. Open browser Developer Tools (F12)
2. Go to Application > Local Storage
3. Copy the values for:
   - `services`
   - `leads`
   - `pipelineStages`
4. Save to a text file

### Restore Data

1. Open Developer Tools
2. Application > Local Storage
3. Paste saved values back into respective keys
4. Refresh the page

### Clear All Data

```javascript
// Open browser console and run:
localStorage.clear();
// Then refresh the page
```

## Tips for Success

### Accurate Measurements
- Use Google Maps or satellite imagery for area calculations
- Keep a measurement template for common property types
- Document unusual site conditions in bid notes

### Competitive Pricing
- Start with catalog pricing as baseline
- Adjust based on site complexity, access, competition
- Track win/loss rates by pricing adjustments

### Pipeline Management
- Move leads through stages promptly
- Set follow-up dates for all active leads
- Review "Proposal Sent" stage weekly
- Update estimated values as you refine scope

### Professional Proposals
- Include clear contract start/end dates
- Add notes about exclusions or special conditions
- Reference similar properties you maintain
- Highlight unique value propositions

## Technical Stack

- **React 18** - UI framework
- **jsPDF** - PDF generation
- **lucide-react** - Icons
- **localStorage** - Data persistence

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with localStorage support

## Support

For questions or feature requests, contact Eric at True Star Outdoor Solutions.

## Version History

- **v1.0** (January 2026)
  - Initial release
  - Service catalog with 16 default services
  - Bid generator with measurement inputs
  - Pipeline manager with customizable stages
  - PDF proposal generation
  - localStorage persistence

## Future Enhancements (Potential)

- Customer database with contact history
- Email integration for sending proposals
- Calendar integration for follow-ups
- Mobile app version
- Multi-user access with cloud sync
- Financial reporting and analytics
- Equipment/crew scheduling
- Photo documentation
- Digital signatures on proposals
