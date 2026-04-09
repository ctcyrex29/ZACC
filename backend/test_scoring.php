<?php
/**
 * Dry-run the expert system against all 15 test cases.
 * This script loads the trait methods and scores each test case WITHOUT writing to DB.
 */
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Quick anonymous class that uses the trait so we can call the scoring methods
$scorer = new class {
    use App\Http\Controllers\Api\ReportControllerHelpers;
    public function score(array $data): array {
        $priority = $this->determineExpertPriority($data);
        $risk = $this->calculateRiskScore(array_merge($data, ['priority' => $priority]));
        return ['priority' => $priority, 'risk' => $risk, 'raw' => $this->lastExpertRawScore];
    }
};

$cases = [
    [
        'expected' => 'CRITICAL',
        'type' => 'Embezzlement',
        'institution' => 'Ministry of Finance and Economic Development',
        'location' => 'Harare',
        'description' => 'The Permanent Secretary in the Ministry of Finance has been systematically diverting public funds allocated for rural development projects into personal offshore bank accounts held in Mauritius. Approximately USD $4.2 million has been embezzled over the past 18 months through fraudulent payment vouchers and ghost supplier invoices. Internal auditors flagged discrepancies but their reports were suppressed by the Director of Internal Audit who is allegedly complicit. Bank statements, payment records, and forged supplier contracts have been obtained as evidence. Multiple whistleblowers within the ministry corroborate the scheme.',
    ],
    [
        'expected' => 'CRITICAL',
        'type' => 'Procurement Fraud',
        'institution' => 'Zimbabwe National Roads Administration (ZINARA)',
        'location' => 'Bulawayo',
        'description' => 'A senior director at ZINARA awarded a $12 million road rehabilitation tender to a company owned by his brother-in-law without following competitive bidding procedures. The contract price is inflated by approximately 300% compared to market rates. The road in question — the Bulawayo-Nkayi highway — remains unrepaired 14 months after the contract was signed despite full advance payment being released. Documentary evidence includes the tender evaluation report showing manipulation of scoring criteria, bank transfer records, and company registration documents linking the director to the awarded firm. A cabinet minister reportedly intervened to fast-track the payment.',
    ],
    [
        'expected' => 'HIGH',
        'type' => 'Abuse of Office',
        'institution' => 'Harare City Council',
        'location' => 'Harare',
        'description' => 'The Town Clerk has been approving illegal land allocations in Budiriro and Glen Norah suburbs to politically connected individuals, bypassing the Urban Council\'s land committee. Over 200 residential stands have been allocated without proper planning approval, environmental impact assessments or payment of prescribed fees. Several councillors have received stands as inducements to keep quiet. The allocations violate the Regional Town and Country Planning Act. Affected residents have submitted complaints that were ignored. Meeting minutes and allocation letters have been obtained showing irregular approvals.',
    ],
    [
        'expected' => 'HIGH',
        'type' => 'Bribery',
        'institution' => 'Zimbabwe Republic Police — Traffic Section',
        'location' => 'Masvingo',
        'description' => 'Officers at the Masvingo Vehicle Inspection Depot are demanding bribes of USD $50–$200 from motorists to pass vehicles that would otherwise fail roadworthiness tests. This has been going on for at least two years. Vehicles with serious mechanical faults — including faulty brakes and missing seatbelts — are being certified as roadworthy after payment. This practice directly endangers public safety. Multiple motorists have come forward with audio recordings of officers soliciting bribes and mobile money transaction records showing payments to the officers\' personal EcoCash numbers. The officer-in-charge is aware and takes a cut of the proceeds.',
    ],
    [
        'expected' => 'HIGH',
        'type' => 'Embezzlement',
        'institution' => 'Grain Marketing Board (GMB)',
        'location' => 'Mashonaland Central',
        'description' => 'The depot manager at GMB Bindura has been selling government-owned maize stocks to private buyers and pocketing the proceeds. An estimated 800 tonnes of strategic grain reserves worth USD $320,000 are unaccounted for over the past harvest season. Stock records have been falsified to show the grain was distributed to drought-relief beneficiaries, but the communities in question confirm they never received the supplies. Truck weighbridge logs at the depot contradict the official dispatch records. Three junior staff members witnessed the unauthorized sales and are willing to provide statements.',
    ],
    [
        'expected' => 'MEDIUM',
        'type' => 'Nepotism',
        'institution' => 'National Social Security Authority (NSSA)',
        'location' => 'Harare',
        'description' => 'The General Manager at NSSA has hired 15 members of his extended family into various positions within the organization over the past three years, including his wife as Head of Human Resources, his nephew as IT Manager, and several cousins in mid-level administrative roles. None of these individuals went through proper recruitment processes and several lack the minimum qualifications for their positions. Staff morale is extremely low and qualified internal candidates were passed over for promotions. HR records and organograms showing the family connections have been compiled by concerned employees.',
    ],
    [
        'expected' => 'MEDIUM',
        'type' => 'Abuse of Office',
        'institution' => 'District Development Fund (DDF)',
        'location' => 'Matabeleland South',
        'description' => 'The Provincial Administrator has been commandeering DDF equipment — graders, water bowsers, and tractors — for use on his private farm in Gwanda district. Government vehicles meant for community borehole drilling are regularly diverted to service the farm. Fuel allocated for public projects is consumed by these private activities. Community water projects in Beitbridge and Mangwe districts are months behind schedule as a direct result. DDF workshop logbooks and fuel consumption records show unexplained usage spikes that coincide with the farming season.',
    ],
    [
        'expected' => 'MEDIUM',
        'type' => 'Procurement Fraud',
        'institution' => 'Midlands State University',
        'location' => 'Midlands',
        'description' => 'The university\'s procurement department has been consistently awarding catering and stationery supply contracts to a single company without open tender. The company, registered only six months before winning its first contract, charges prices roughly 40% above market value. Over the past two academic years the university has paid this supplier approximately USD $890,000. The company\'s registered address is a residential property in Gweru. Purchase orders, invoices, and the company\'s registration documents have been gathered by a concerned staff member.',
    ],
    [
        'expected' => 'LOW',
        'type' => 'Other',
        'institution' => 'Mutare City Council — Parks Department',
        'location' => 'Manicaland',
        'description' => 'A parks supervisor has been using council lawnmowers and gardening equipment to do private landscaping jobs on weekends and charging customers personally. Council fuel is also being used for these side jobs. The total value involved is relatively small — perhaps a few hundred dollars over several months — but it represents a misuse of public resources. Neighbours of the supervisor have witnessed the equipment being loaded onto a council truck on Saturday mornings and can provide statements.',
    ],
    [
        'expected' => 'LOW',
        'type' => 'Other',
        'institution' => 'Chipinge Rural District Council',
        'location' => 'Manicaland',
        'description' => 'A clerk at the council office has been charging residents unofficial "processing fees" of USD $5–$10 for services that should be free, such as issuing certified copies of birth records and confirming residential addresses. The amounts are small but the practice affects vulnerable community members who cannot afford extra costs. Several residents have complained verbally but no written records of the complaints exist yet. The clerk has been doing this for approximately six months.',
    ],
    [
        'expected' => 'CRITICAL',
        'type' => 'Bribery',
        'institution' => 'Zimbabwe Anti-Corruption Commission (ZACC)',
        'location' => 'Harare',
        'description' => 'A Commissioner at ZACC itself has allegedly been accepting bribes from individuals under investigation to ensure their cases are either dropped or indefinitely delayed. At least three high-profile investigations into senior government officials have been stalled after payments of between USD $20,000 and $50,000 were reportedly made through intermediaries. A former ZACC investigator who resigned in protest has provided a detailed sworn affidavit naming the Commissioner, the intermediaries, and the suspects whose cases were shelved. Mobile money records and meeting photographs corroborate the allegations. This represents corruption at the highest level of the very institution mandated to fight it.',
    ],
    [
        'expected' => 'CRITICAL (Shona)',
        'type' => 'Embezzlement',
        'institution' => 'Ministry of Health and Child Care',
        'location' => 'Mashonaland East',
        'description' => 'Mudzimu wekuMinistry of Health akaba mari yezvibhedha zvechipatara cheMarondera Provincial Hospital. USD $1.8 million yaifanira kuitiswa kuti zvibhedha zviwanikwe uye mishonga ibve itengerwa varwere, asi mari yacho haina kusvika. Mukuru weMinistry — Director of Provincial Health Services — akasaina mavhaucha ekubhadhara kune makambani asipo. Bank statements dzinoratidza mari yakaenda kumaakhaunti ake ari maviri nemaakhaunti emhuri yake. Varwere vari kurara pasi muchipatara uye mishonga haiwanikwe. Manesi nevashandi vechipatara vanogona kutaura zvavakaona. Izvi zviri kukuvadza vanhu varombo vari kufa nekuda kwehuori.',
    ],
    [
        'expected' => 'HIGH (Ndebele)',
        'type' => 'Procurement Fraud',
        'institution' => 'Bulawayo City Council — Water Department',
        'location' => 'Bulawayo',
        'description' => 'Umkhokheli ophezulu eBulawayo City Council Water Department uthenge amapayipi amanzi ngentengo ephezulu kakhulu enkampanini engekho enye ngaphandle kwaleyo yakhe. Isivumelwano se-tender sasingavulwanga emphakathini njengomthetho. Intengo yayiphezulu nge-200% ukwedlula intengo yezimakethe. Imali engaba yi-USD $500,000 isebenzisiwe ngonyaka edlulileyo kodwa amapayipi amanzi amanengi awakafikanga. Amarekhodi e-procurement kanye lezincwadi ze-tender zikhona njengobufakazi. Abantu baseBulawayo abalamthombo wamanzi ngenxa yalokhu.',
    ],
    [
        'expected' => 'HIGH',
        'type' => 'Abuse of Office',
        'institution' => 'Zimbabwe Electoral Commission (ZEC)',
        'location' => 'Mashonaland West',
        'description' => 'A senior ZEC official in Chinhoyi has been using voter registration data to identify and intimidate opposition supporters before by-elections. Voter roll information — including home addresses and ID numbers — has been shared with political party operatives who then visit these individuals to threaten them. Multiple voters in Chinhoyi and Karoi have reported receiving threatening visits days after registering. The official also diverted election materials and funding meant for voter education campaigns in rural wards. I am submitting this anonymously because I fear for my safety as a ZEC employee.',
    ],
    [
        'expected' => 'MEDIUM',
        'type' => 'Bribery',
        'institution' => 'Immigration Department',
        'location' => 'Harare',
        'description' => 'Officials at Makombe Building are asking for bribes to process passport applications faster. People are being told to pay between USD $100 and $300 on top of the official fee to get their passports within two weeks instead of the usual three-month wait. This has been happening for a long time and everyone in the queue knows about it. I do not have documents but I personally experienced this last month.',
    ],
];

echo str_pad("CASE", 6) . str_pad("EXPECTED", 20) . str_pad("ACTUAL", 10) . str_pad("RAW", 6) . str_pad("RISK", 6) . "MATCH?\n";
echo str_repeat('-', 60) . "\n";

$pass = 0;
$total = count($cases);

foreach ($cases as $i => $case) {
    $result = $scorer->score([
        'type' => $case['type'],
        'description' => $case['description'],
        'institution' => $case['institution'],
        'location' => $case['location'],
    ]);
    
    // Check if actual matches expected (extract the priority part)
    $expectedPriority = strtoupper(explode(' ', $case['expected'])[0]);
    $match = ($result['priority'] === $expectedPriority) ? 'YES' : '** NO **';
    if ($match === 'YES') $pass++;
    
    printf(
        "%-6s%-20s%-10s%-6s%-6s%s\n",
        ($i + 1),
        $case['expected'],
        $result['priority'],
        $result['raw'],
        $result['risk'],
        $match
    );
}

echo str_repeat('-', 60) . "\n";
echo "Passed: {$pass}/{$total}\n";
