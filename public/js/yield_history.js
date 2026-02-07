    import { app } from '../firebase-config.js';
    import { initAuthSidebar } from './Auth.js';
    import {
        getAuth,
        onAuthStateChanged
    } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
    import {
        getFirestore,
        collection,
        query,
        orderBy,
        getDocs,
        onSnapshot
    } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

    const auth = getAuth(app);
    const db = getFirestore(app);

    // ------------------------------------------------------------------
    // CONFIGURATION
    // ------------------------------------------------------------------
    const PREDICTIONS_COLLECTION = 'monthlyYieldSummary'; // Collection for prediction data
    const HARVEST_COLLECTION = 'farm_history'; // Collection for harvest data

    // Fallback collections that we know exist
    const FALLBACK_FARM_COLLECTION = 'Farm_information'; // Existing collection with farm data
    const FALLBACK_USERS_COLLECTION = 'users'; // Existing collection with user data

    // ------------------------------------------------------------------
    // DATA SERVICE
    // ------------------------------------------------------------------
    class YieldHistoryDataService {
        constructor() {
            this.predictionsRef = collection(db, PREDICTIONS_COLLECTION);
            this.harvestRef = collection(db, HARVEST_COLLECTION);

        }

        async fetchPredictions() {
            console.log('🔄 Fetching predictions from:', PREDICTIONS_COLLECTION);

            try {
                const q = query(
                    this.predictionsRef,
                    orderBy('calculated_at', 'desc')
                );

                const querySnapshot = await getDocs(q);
                console.log(`✅ Found ${querySnapshot.docs.length} prediction documents from '${PREDICTIONS_COLLECTION}'`);

                if (querySnapshot.docs.length > 0) {
                    // Use the real data from the collection - NO FALLBACK TO RANDOM DATA
                    const data = [];
                    querySnapshot.forEach((doc) => {
                        const raw = doc.data();
                        console.log('📄 Raw prediction document:', doc.id, JSON.stringify(raw, null, 2));

                        // Try to map the data with different possible field names
                        const prediction = {
                            id: doc.id,
                            predicted_1month: parseFloat(raw.predicted_1month || raw['1month'] || raw.predicted_1_month || raw.month1 || 0),
                            predicted_2months: parseFloat(raw.predicted_2months || raw['2months'] || raw.predicted_2_months || raw.month2 || 0),
                            predicted_3months: parseFloat(raw.predicted_3months || raw['3months'] || raw.predicted_3_months || raw.month3 || 0),
                            predicted_next_day: parseFloat(raw.predicted_next_day || raw.next_day || raw.tomorrow || raw.day1 || 0),
                            total_yield: parseFloat(raw.total_yield || raw.totalYield || raw.yield || 0),
                            calculated_at: raw.calculated_at || raw.calculatedAt || raw.timestamp || raw.date || new Date().toISOString()
                        };

                        console.log('📊 Mapped prediction data:', prediction);
                        data.push(prediction);
                    });

                    console.log('✅ Using real prediction data:', data.length, 'records');
                    return data;
                } else {
                    console.log('⚠️ Collection exists but is empty - NO DATA TO DISPLAY');
                    console.log('💡 To add data: Go to Firebase Console → monthlyYieldSummary collection → Add document');
                    return []; // Return empty array instead of random data
                }
            } catch (error) {
                console.error(`❌ Error accessing collection '${PREDICTIONS_COLLECTION}':`, error);
                console.log('🔍 Possible issues:');
                console.log('   - Collection does not exist');
                console.log('   - Permission denied');
                console.log('   - Network issues');
                console.log('💡 Check Firebase Console: https://console.firebase.google.com/project/calamansisys/firestore/data');
                return []; // Return empty array instead of random data
            }
        }

        async fetchHarvestHistory() {
            console.log('🔄 Fetching harvest history from:', HARVEST_COLLECTION);

            try {
                const q = query(
                    this.harvestRef,
                    orderBy('date', 'desc')
                );

                const querySnapshot = await getDocs(q);
                console.log(`✅ Found ${querySnapshot.docs.length} harvest documents from '${HARVEST_COLLECTION}'`);

                if (querySnapshot.docs.length > 0) {
                    // Use the real harvest data
                    const data = [];
                    querySnapshot.forEach((doc) => {
                        const raw = doc.data();
                        console.log('📄 Raw harvest document:', doc.id, JSON.stringify(raw, null, 2));

                        // Try to map the data with different possible field names
                        const harvest = {
                            id: doc.id,
                            batch_id: raw.batch_id || raw.batchId || raw.batch || doc.id,
                            FarmerName: raw.FarmerName || raw.farmerName || raw.farmer || raw.name || '',
                            Inspector_notes: raw.Inspector_notes || raw.inspectorNotes || raw.notes || raw.inspector_notes || '',
                            date: raw.date || raw.harvestDate || raw.createdAt || '',
                            harvestDate: raw.harvestDate || raw.date || '',
                            harvestYield: raw.harvestYield || raw.yield || raw.weight || raw.amount || '',
                            quality: raw.quality || raw.grade || '',
                            status: raw.status || raw.state || ''
                        };

                        console.log('🌾 Mapped harvest data:', harvest);
                        data.push(harvest);
                    });

                    console.log('✅ Using real harvest data:', data.length, 'records');
                    return data;
                } else {
                    console.log('⚠️ Collection exists but is empty - NO DATA TO DISPLAY');
                    console.log('💡 To add data: Go to Firebase Console → farm_history collection → Add document');
                    return []; // Return empty array instead of random data
                }
            } catch (error) {
                console.error(`❌ Error accessing collection '${HARVEST_COLLECTION}':`, error);
                console.log('🔍 Possible issues:');
                console.log('   - Collection does not exist');
                console.log('   - Permission denied');
                console.log('   - Network issues');
                console.log('💡 Check Firebase Console: https://console.firebase.google.com/project/calamansisys/firestore/data/monthlyYieldSummary/');
                return []; // Return empty array instead of random data
            }
        }

        async fetchSummaryStats() {
            console.log('🔄 Fetching summary stats from:', HARVEST_COLLECTION);

            try {
                const q = query(this.harvestRef);
                const querySnapshot = await getDocs(q);
                console.log(`✅ Found ${querySnapshot.docs.length} documents for summary stats`);

                let totalDispatchedValue = 0; // sum of yields for dispatched
                let totalStoredValue = 0; // sum of yields for stored
                let totalDispatchedCount = 0; // count of dispatched items
                let totalStoredCount = 0; // count of stored items
                let totalYields = 0;

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    console.log('📊 Processing document:', doc.id, 'Status:', data.status, 'Yield:', data.harvestYield);
                    
                    if (data.status === 'Dispatch') {
                        totalDispatchedCount++;
                        if (data.harvestYield) {
                            const yieldMatch = data.harvestYield.toString().match(/(\d+(\.\d+)?)/);
                            const yieldValue = yieldMatch ? parseFloat(yieldMatch[1]) : 0;
                            console.log('📊 Dispatched item yield:', yieldValue);
                            totalDispatchedValue += yieldValue;
                            totalYields += yieldValue;
                        }
                    }
                    if (data.status === 'Stored') {
                        totalStoredCount++;
                        if (data.harvestYield) {
                            const yieldMatch = data.harvestYield.toString().match(/(\d+(\.\d+)?)/);
                            const yieldValue = yieldMatch ? parseFloat(yieldMatch[1]) : 0;
                            console.log('📊 Stored item yield:', yieldValue);
                            totalStoredValue += yieldValue;
                            totalYields += yieldValue;
                        }
                    }
                });

                const stats = {
                    totalDispatched: totalDispatchedValue,
                    totalStored: totalStoredValue,
                    totalYields,
                    totalRecords: totalDispatchedCount + totalStoredCount
                };

                console.log('✅ Summary stats calculated:', stats);
                return stats;
            } catch (error) {
                console.error('❌ Error fetching summary stats:', error);
                return { totalDispatched: 0, totalStored: 0, totalYields: 0 };
            }
        }

        // Add sample data to collections for testing
        async addSampleData() {
            console.log('📝 Adding sample data to collections...');

            try {
                // Add sample prediction data
                const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");

                // Sample prediction data
                const predictionData = {
                    predicted_1month: 25.5,
                    predicted_2months: 45.8,
                    predicted_3months: 67.2,
                    predicted_next_day: 2.1,
                    total_yield: 138.6,
                    calculated_at: new Date().toISOString()
                };

                await setDoc(doc(this.predictionsRef), predictionData);
                console.log('✅ Added sample prediction data');

                // Sample harvest data
                const harvestData = {
                    batch_id: 'BATCH001',
                    FarmerName: 'Juan Dela Cruz',
                    Inspector_notes: 'Good quality harvest, ready for market',
                    date: new Date().toISOString(),
                    harvestDate: new Date().toISOString(),
                    harvestYield: '50 kg',
                    quality: 'Grade A',
                    status: 'Completed'
                };

                await setDoc(doc(this.harvestRef), harvestData);
                console.log('✅ Added sample harvest data');

                console.log('🎉 Sample data added! Refresh the page to see it.');
                return true;

            } catch (error) {
                console.error('❌ Error adding sample data:', error);
                return false;
            }
        }

        async debugCollections() {
            console.log('🔍 DEBUG: Checking collections manually...');

            try {
                console.log('📊 Checking monthlyYieldSummary (for prediction cards)...');
                const predSnapshot = await getDocs(collection(db, 'monthlyYieldSummary'));
                console.log(`📊 monthlyYieldSummary: ${predSnapshot.docs.length} documents`);
                if (predSnapshot.docs.length > 0) {
                    predSnapshot.docs.slice(0, 3).forEach((doc, i) => {
                        console.log(`   Doc ${i+1}:`, doc.id, doc.data());
                    });
                } else {
                    console.log('   ⚠️ No documents found - this explains "No Data" in cards');
                }

                console.log('🌾 Checking farm_history (for harvest table)...');
                const harvestSnapshot = await getDocs(collection(db, 'farm_history'));
                console.log(`🌾 farm_history: ${harvestSnapshot.docs.length} documents`);
                if (harvestSnapshot.docs.length > 0) {
                    harvestSnapshot.docs.slice(0, 3).forEach((doc, i) => {
                        console.log(`   Doc ${i+1}:`, doc.id, doc.data());
                    });
                } else {
                    console.log('   ⚠️ No documents found - this explains empty table');
                }

            } catch (error) {
                console.error('❌ Debug error:', error);
                console.log('💡 This collection may not exist in Firebase');
            }
        }

        // DEBUG: Check what data actually exists in your collections
        async checkRealData() {
            console.log('🔍 CHECKING REAL DATA in your Firestore collections...');
            console.log('================================================');

            const collections = ['monthlyYieldSummary', 'farm_history'];

            for (const collName of collections) {
                console.log(`\n📂 Checking collection: ${collName}`);
                console.log('------------------------------------------------');

                try {
                    const snapshot = await getDocs(collection(db, collName));
                    console.log(`✅ Found ${snapshot.docs.length} documents`);

                    if (snapshot.docs.length > 0) {
                        snapshot.docs.forEach((doc, index) => {
                            console.log(`\n📄 Document ${index + 1} (ID: ${doc.id}):`);
                            const data = doc.data();
                            console.log('Raw data:', JSON.stringify(data, null, 2));

                            // Show all field names
                            console.log('Field names:', Object.keys(data));

                            // Check for expected fields
                            if (collName === 'monthlyYieldSummary') {
                                console.log('Expected prediction fields:');
                                console.log('  - predicted_1month:', data.predicted_1month || 'NOT FOUND');
                                console.log('  - predicted_2months:', data.predicted_2months || 'NOT FOUND');
                                console.log('  - predicted_3months:', data.predicted_3months || 'NOT FOUND');
                                console.log('  - predicted_next_day:', data.predicted_next_day || 'NOT FOUND');
                                console.log('  - total_yield:', data.total_yield || 'NOT FOUND');
                                console.log('  - calculated_at:', data.calculated_at || 'NOT FOUND');
                            } else if (collName === 'farm_history') {
                                console.log('Expected harvest fields:');
                                console.log('  - batch_id:', data.batch_id || 'NOT FOUND');
                                console.log('  - FarmerName:', data.FarmerName || 'NOT FOUND');
                                console.log('  - Inspector_notes:', data.Inspector_notes || 'NOT FOUND');
                                console.log('  - date:', data.date || 'NOT FOUND');
                                console.log('  - harvestYield:', data.harvestYield || 'NOT FOUND');
                                console.log('  - quality:', data.quality || 'NOT FOUND');
                                console.log('  - status:', data.status || 'NOT FOUND');
                            }
                        });
                    } else {
                        console.log('❌ No documents found in this collection');
                    }

                } catch (error) {
                    console.log(`❌ Error accessing ${collName}:`, error.message);
                }
            }

            console.log('\n================================================');
            console.log('💡 If fields don\'t match, the code needs to be updated!');
            console.log('================================================');
        }
    }

    // ------------------------------------------------------------------
    // UI CONTROLLER
    // ------------------------------------------------------------------
    class YieldHistoryUI {
        constructor() {
            this.summaryCards = {
                'total-dispatched': document.getElementById('total-dispatched'),
                'total-stored': document.getElementById('total-stored'),
                'total-yields': document.getElementById('total-yields'),
                'total-records': document.getElementById('total-records')
            };
            this.harvestTableBody = document.getElementById('yield-history-table-body');
            this.errorContainer = document.getElementById('error-container');
            this.errorMessage = document.getElementById('error-message');
            this.detailsModal = document.getElementById('detailsModal');
            this.currentHarvest = null;
            
            // Pagination properties
            this.currentPage = 1;
            this.itemsPerPage = 10;
            this.totalItems = 0;
            this.filteredData = [];
            
            // Pagination elements
            this.paginationInfo = document.querySelector('.text-sm.text-slate-500');
            this.pageButtonsContainer = document.getElementById('pagination-buttons');
            this.paginationContainer = this.pageButtonsContainer.parentElement;
            this.prevButton = this.pageButtonsContainer.querySelector('.fa-chevron-left').parentElement;
            this.nextButton = this.pageButtonsContainer.querySelector('.fa-chevron-right').parentElement;
            
            // Filter elements
            this.searchInput = document.getElementById('searchInput');
            this.gradeFilter = document.getElementById('gradeFilter');
            
            this.initPagination();
            this.initFilters();
            this.initFilters();
        }

        initPagination() {
            if (this.prevButton) {
                this.prevButton.addEventListener('click', () => this.changePage(this.currentPage - 1));
            }
            if (this.nextButton) {
                this.nextButton.addEventListener('click', () => this.changePage(this.currentPage + 1));
            }
        }

        initFilters() {
            if (this.searchInput) {
                this.searchInput.addEventListener('input', () => this.handleFilter());
            }
            if (this.gradeFilter) {
                this.gradeFilter.addEventListener('change', () => this.handleFilter());
            }
        }

        handleFilter() {
            const searchQuery = this.searchInput ? this.searchInput.value : '';
            const gradeFilter = this.gradeFilter ? this.gradeFilter.value : 'All';
            this.filterData(searchQuery, gradeFilter);
        }

        updateSummary(stats) {
            console.log('📊 Updating summary stats cards...');
            console.log('📊 Stats data received:', stats);

            // Reset all cards to "No Data"
            Object.values(this.summaryCards).forEach(card => {
                if (card) card.textContent = 'No Data';
            });

            if (stats) {
                if (this.summaryCards['total-dispatched']) {
                    this.summaryCards['total-dispatched'].textContent = `${stats.totalDispatched || 0} kg`;
                }
                if (this.summaryCards['total-stored']) {
                    this.summaryCards['total-stored'].textContent = `${stats.totalStored || 0} kg`;
                }
                if (this.summaryCards['total-yields']) {
                    this.summaryCards['total-yields'].textContent = `${stats.totalYields || 0} kg`;
                }
                if (this.summaryCards['total-records']) {
                    this.summaryCards['total-records'].textContent = (stats.totalDispatched + stats.totalStored) || 0;
                }

                console.log('✅ Updated summary cards with real data');
            } else {
                console.log('⚠️ No stats data available');
            }
        }

        updateHarvestTable(harvests) {
            console.log('📋 Updating harvest history table...');

            if (!this.harvestTableBody) {
                console.error('❌ Harvest table body not found');
                return;
            }

            // Store all data and reset to page 1
            this.originalData = harvests || [];
            this.filteredData = [...this.originalData];
            this.totalItems = this.filteredData.length;
            this.currentPage = 1;

            this.renderTable();
            this.updatePagination();
        }

        renderTable() {
            // Clear existing rows
            this.harvestTableBody.innerHTML = '';

            if (this.filteredData.length > 0) {
                // Calculate pagination
                const startIndex = (this.currentPage - 1) * this.itemsPerPage;
                const endIndex = startIndex + this.itemsPerPage;
                const pageData = this.filteredData.slice(startIndex, endIndex);

                pageData.forEach(harvest => {
                    // Parse yield value for display
                    const yieldMatch = harvest.harvestYield ? harvest.harvestYield.toString().match(/(\d+(\.\d+)?)/) : null;
                    const displayYield = yieldMatch ? yieldMatch[1] + ' kg' : 'N/A';

                    const row = document.createElement('tr');
                    row.className = 'border-b border-gray-200 hover:bg-gray-50';

                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${harvest.date ? new Date(harvest.date).toLocaleDateString() : 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${harvest.batch_id || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${harvest.FarmerName || 'N/A'}</td>  
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayYield}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${harvest.quality || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                harvest.status === 'Stored' ? 'bg-green-100 text-green-800' : 
                                harvest.status === 'Dispatched' ? 'bg-red-100 text-red-800' : 
                                 harvest.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800' 
                            }">
                                ${harvest.status || 'Pending'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onclick='window.app.ui.viewDetails(${JSON.stringify(harvest).replace(/'/g, "\\'")})' class="text-lime-600 hover:text-lime-900 bg-lime-50 hover:bg-lime-100 px-3 py-1 rounded-md transition">View</button>
                        </td>
                    `;

                    this.harvestTableBody.appendChild(row);
                });

                console.log(`✅ Added ${pageData.length} harvest records to table (page ${this.currentPage})`);
            } else {
                // Show "No Data" row
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `
                    <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                        No harvest data available
                    </td>
                `;
                this.harvestTableBody.appendChild(emptyRow);
                console.log('⚠️ No harvest data to display');
            }
        }

        updatePagination() {
            // Hide pagination buttons if 10 or fewer items, but show total count
            if (this.totalItems <= 10) {
                if (this.paginationContainer) {
                    this.paginationContainer.style.display = 'flex';
                }
                if (this.pageButtonsContainer) {
                    this.pageButtonsContainer.style.display = 'none';
                }
                if (this.paginationInfo) {
                    this.paginationInfo.innerHTML = `Total: <span class="font-bold text-slate-800">${this.totalItems}</span> entries`;
                }
                return;
            }

            // Show pagination
            if (this.paginationContainer) {
                this.paginationContainer.style.display = 'flex';
            }
            if (this.pageButtonsContainer) {
                this.pageButtonsContainer.style.display = 'flex';
            }

            const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
            const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
            const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);

            // Update pagination info
            if (this.paginationInfo) {
                this.paginationInfo.innerHTML = `Showing <span class="font-bold text-slate-800">${startItem}-${endItem}</span> of <span class="font-bold text-slate-800">${this.totalItems}</span> entries`;
            }

            // Update button states
            if (this.prevButton) {
                this.prevButton.disabled = this.currentPage === 1;
                this.prevButton.classList.toggle('disabled:opacity-50', this.currentPage === 1);
            }
            if (this.nextButton) {
                this.nextButton.disabled = this.currentPage === totalPages;
                this.nextButton.classList.toggle('disabled:opacity-50', this.currentPage === totalPages);
            }

            // Update page buttons
            this.updatePageButtons(totalPages);
        }

        updatePageButtons(totalPages) {
            if (!this.pageButtonsContainer) return;

            // Clear existing page buttons except prev/next
            const existingButtons = Array.from(this.pageButtonsContainer.querySelectorAll('button')).filter(btn => !btn.querySelector('.fa-chevron-left') && !btn.querySelector('.fa-chevron-right'));
            existingButtons.forEach(btn => btn.remove());

            // Insert page buttons before next button
            const nextButton = this.nextButton;
            
            // Determine which pages to show
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, this.currentPage + 2);
            
            // Adjust if we're near the beginning or end
            if (endPage - startPage < 4) {
                if (startPage === 1) {
                    endPage = Math.min(totalPages, startPage + 4);
                } else if (endPage === totalPages) {
                    startPage = Math.max(1, endPage - 4);
                }
            }

            // Add page buttons
            for (let i = startPage; i <= endPage; i++) {
                const pageButton = document.createElement('button');
                pageButton.className = `px-3 py-1 text-sm border rounded-md transition ${
                    i === this.currentPage 
                        ? 'border-lime-500 bg-lime-50 text-lime-700 font-medium' 
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`;
                pageButton.textContent = i;
                pageButton.addEventListener('click', () => this.changePage(i));
                
                this.pageButtonsContainer.insertBefore(pageButton, nextButton);
            }

            // Add ellipsis if needed
            if (startPage > 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'px-2 text-slate-400';
                ellipsis.textContent = '...';
                this.pageButtonsContainer.insertBefore(ellipsis, this.pageButtonsContainer.children[1]);
            }
            
            if (endPage < totalPages) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'px-2 text-slate-400';
                ellipsis.textContent = '...';
                this.pageButtonsContainer.insertBefore(ellipsis, nextButton);
            }
        }

        changePage(page) {
            const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
            if (page < 1 || page > totalPages) return;
            
            this.currentPage = page;
            this.renderTable();
            this.updatePagination();
        }

        // Method to filter data (called from search/filter)
        filterData(searchQuery = '', gradeFilter = 'All') {
            // Store original data if not already stored
            if (!this.originalData) {
                this.originalData = [...this.filteredData];
            }
            
            let filtered = [...this.originalData];
            
            // Apply search filter
            if (searchQuery) {
                filtered = filtered.filter(item => 
                    (item.batch_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.FarmerName || '').toLowerCase().includes(searchQuery.toLowerCase())
                );
            }
            
            // Apply grade filter
            if (gradeFilter !== 'All') {
                filtered = filtered.filter(item => item.quality === gradeFilter);
            }
            
            // Update filtered data and reset to page 1
            this.filteredData = filtered;
            this.totalItems = filtered.length;
            this.currentPage = 1;
            
            this.renderTable();
            this.updatePagination();
        }

        viewDetails(harvest) {
            this.currentHarvest = harvest;
            // Parse yield value for display
            const yieldMatch = harvest.harvestYield ? harvest.harvestYield.toString().match(/(\d+(\.\d+)?)/) : null;
            const displayYield = yieldMatch ? yieldMatch[1] + ' kg' : 'N/A';

            document.getElementById('modalBatchId').innerText = harvest.batch_id || 'N/A';
            document.getElementById('modalFarmer').innerText = harvest.FarmerName || 'N/A';
            document.getElementById('modalDate').innerText = harvest.date ? new Date(harvest.date).toLocaleDateString() : 'N/A';
            document.getElementById('modalWeight').innerText = displayYield;
            
            const gradeEl = document.getElementById('modalGrade');
            gradeEl.innerText = harvest.quality || 'N/A';
            gradeEl.className = `text-lg font-bold ${harvest.quality === 'Grade A' ? 'text-green-600' : 'text-yellow-600'}`;

            document.getElementById('modalNotes').innerText = harvest.Inspector_notes || 'No notes available';

            this.detailsModal.classList.remove('hidden');
            // Small delay for transition
            requestAnimationFrame(() => {
                this.detailsModal.classList.remove('opacity-0');
                this.detailsModal.querySelector('div').classList.remove('scale-95');
                this.detailsModal.querySelector('div').classList.add('scale-100');
            });
        }

        closeModal() {
            this.detailsModal.classList.add('opacity-0');
            this.detailsModal.querySelector('div').classList.remove('scale-100');
            this.detailsModal.querySelector('div').classList.add('scale-95');
            setTimeout(() => {
                this.detailsModal.classList.add('hidden');
            }, 300);
        }

        editRecord() {
            if (!this.currentHarvest) return;
            
            // Toggle edit mode
            const modalContent = this.detailsModal.querySelector('div');
            const isEditing = modalContent.classList.contains('editing');
            
            if (isEditing) {
                // Save changes
                this.saveEdits();
            } else {
                // Enter edit mode
                this.enterEditMode();
            }
        }

        enterEditMode() {
            const modalContent = this.detailsModal.querySelector('div');
            modalContent.classList.add('editing');
            
            // Replace text with inputs
            const farmerEl = document.getElementById('modalFarmer');
            const weightEl = document.getElementById('modalWeight');
            const gradeEl = document.getElementById('modalGrade');
            const notesEl = document.getElementById('modalNotes');
            
            // Farmer input
            const farmerInput = document.createElement('input');
            farmerInput.type = 'text';
            farmerInput.value = this.currentHarvest.FarmerName || '';
            farmerInput.className = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-lime-500';
            farmerEl.parentNode.replaceChild(farmerInput, farmerEl);
            farmerInput.id = 'modalFarmer';
            
            // Weight input
            const weightInput = document.createElement('input');
            weightInput.type = 'text';
            const yieldMatch = this.currentHarvest.harvestYield ? this.currentHarvest.harvestYield.toString().match(/(\d+(\.\d+)?)/) : null;
            weightInput.value = yieldMatch ? yieldMatch[1] : '';
            weightInput.className = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-lime-500';
            weightEl.parentNode.replaceChild(weightInput, weightEl);
            weightInput.id = 'modalWeight';
            
            // Grade select
            const gradeSelect = document.createElement('select');
            gradeSelect.className = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-lime-500';
            ['Grade A', 'Grade B', 'Grade C'].forEach(grade => {
                const option = document.createElement('option');
                option.value = grade;
                option.textContent = grade;
                if (grade === this.currentHarvest.quality) option.selected = true;
                gradeSelect.appendChild(option);
            });
            gradeEl.parentNode.replaceChild(gradeSelect, gradeEl);
            gradeSelect.id = 'modalGrade';
            
            // Notes textarea
            const notesTextarea = document.createElement('textarea');
            notesTextarea.value = this.currentHarvest.Inspector_notes || '';
            notesTextarea.className = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-lime-500';
            notesTextarea.rows = 3;
            notesEl.parentNode.replaceChild(notesTextarea, notesEl);
            notesTextarea.id = 'modalNotes';
            
            // Change button text
            const editBtn = this.detailsModal.querySelector('button[onclick*="editRecord"]');
            editBtn.innerHTML = '<i class="fa-solid fa-save mr-2"></i>Save';
        }

        saveEdits() {
            const updatedData = {
                FarmerName: document.getElementById('modalFarmer').value,
                harvestYield: document.getElementById('modalWeight').value + ' kg',
                quality: document.getElementById('modalGrade').value,
                Inspector_notes: document.getElementById('modalNotes').value
            };
            
            // Call update method
            window.app.updateHarvestRecord(this.currentHarvest.id, updatedData);
            
            // Exit edit mode
            this.exitEditMode();
        }

        exitEditMode() {
            const modalContent = this.detailsModal.querySelector('div');
            modalContent.classList.remove('editing');
            
            // Change button back
            const editBtn = this.detailsModal.querySelector('button[onclick*="editRecord"]');
            editBtn.innerHTML = '<i class="fa-solid fa-edit mr-2"></i>Edit';
            
            // Close modal to refresh view
            this.closeModal();
        }

        deleteRecord() {
            if (!this.currentHarvest) return;
            
            if (confirm('Are you sure you want to delete this harvest record? This action cannot be undone.')) {
                // Call delete from data service
                window.app.deleteHarvestRecord(this.currentHarvest);
                this.closeModal();
            }
        }

        getCurrentData() {
            return this.filteredData || [];
        }
    }

    // ------------------------------------------------------------------
    // MAIN APP CONTROLLER
    // ------------------------------------------------------------------
    class YieldHistoryApp {
        constructor() {
            this.dataService = new YieldHistoryDataService();
            this.ui = new YieldHistoryUI();
            this.init();
        }

        async init() {
            console.log('🚀 Initializing Yield History App...');

            // Check authentication
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    console.log('✅ User authenticated:', user.email);
                    await this.loadData();
                } else {
                    console.log('❌ User not authenticated, redirecting to login...');
                    window.location.href = 'index.html';
                }
            });
        }

        async loadData() {
            try {
                console.log('📡 Loading yield history data...');

                // Load summary stats and harvest data in parallel
                const [stats, harvests] = await Promise.all([
                    this.dataService.fetchSummaryStats(),
                    this.dataService.fetchHarvestHistory()
                ]);

                // Update UI with the data (now handles error objects)
                if (stats) {
                    this.ui.updateSummary(stats);
                }

                if (harvests && typeof harvests === 'object' && harvests.status === "No Data") {
                    console.log('⚠️ Harvests error:', harvests.error);
                    this.ui.showError(harvests.error, harvests.type);
                } else {
                    this.ui.updateHarvestTable(harvests);
                }

                console.log('✅ Data loaded successfully');

            } catch (error) {
                console.error('❌ Error loading data:', error);
            }
        }

        async updateHarvestRecord(id, updatedData) {
            try {
                console.log('✏️ Updating harvest record:', id, updatedData);
                
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
                
                await updateDoc(doc(db, 'farm_history', id), updatedData);
                
                console.log('✅ Record updated successfully');
                alert('Record updated successfully!');
                
                // Reload data to refresh the table
                await this.loadData();
                
            } catch (error) {
                console.error('❌ Error updating record:', error);
                alert('Error updating record: ' + error.message);
            }
        }

        async deleteHarvestRecord(harvest) {
            try {
                console.log('🗑️ Deleting harvest record:', harvest.id);
                
                const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
                
                await deleteDoc(doc(db, 'farm_history', harvest.id));
                
                console.log('✅ Record deleted successfully');
                alert('Record deleted successfully!');
                
                // Reload data to refresh the table
                await this.loadData();
                
            } catch (error) {
                console.error('❌ Error deleting record:', error);
                alert('Error deleting record: ' + error.message);
            }
        }

        async addYieldRecord(recordData) {
            try {
                console.log('➕ Adding new yield record:', recordData);
                
                const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
                
                // Add the new record to the farm_history collection
                const docRef = doc(collection(db, 'farm_history'));
                await setDoc(docRef, recordData);
                
                console.log('✅ Record added successfully with ID:', docRef.id);
                
                // Reload data to refresh the table
                await this.loadData();
                
                return docRef.id;
            } catch (error) {
                console.error('❌ Error adding yield record:', error);
                throw error;
            }
        }

        exportData() {
            // Get current filtered data from UI
            const data = this.ui.getCurrentData();
            if (!data || data.length === 0) {
                alert('No data available to export.');
                return;
            }

            // Convert to CSV
            const headers = ['Date', 'Batch ID', 'Farmer', 'Weight (kg)', 'Quality', 'Status'];
            const csvContent = [
                headers.join(','),
                ...data.map(item => {
                    const yieldMatch = item.harvestYield ? item.harvestYield.toString().match(/(\d+(\.\d+)?)/) : null;
                    const yieldValue = yieldMatch ? yieldMatch[1] : 'N/A';
                    return [
                        item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
                        item.batch_id || 'N/A',
                        item.FarmerName || 'N/A',
                        yieldValue,
                        item.quality || 'N/A',
                        item.status || 'Pending'
                    ].join(',');
                })
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `harvest_logs_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Initialize app when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM loaded, initializing Yield History App...');
        initAuthSidebar();
        console.log('🔍 Will fetch data from:');
        console.log('   📊 monthlyYieldSummary → Prediction summary cards (REAL DATA ONLY)');
        console.log('   🌾 farm_history → Harvest history table (REAL DATA ONLY)');
        console.log('ℹ️  No random/fake data will be generated');
        console.log('🔧 Debug: Call app.debugCollections() in console to check specific collections');
        console.log('🔧 Debug: Call app.listAllCollections() in console to check ALL collections in your project');
        console.log('� Debug: Call app.checkRealData() in console to see EXACT field names in your data');
        console.log('�📝 Debug: Call app.addSampleData() in console to add test data');

        window.app = new YieldHistoryApp();
    });

    // Global function for modal close (accessible from HTML)
    window.closeYieldModal = function() {
        if (window.app && window.app.ui) {
            window.app.ui.closeModal();
        }
    };
