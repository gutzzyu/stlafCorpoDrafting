/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Sparkles, 
  FileDown,
  ChevronRight, 
  ChevronLeft,
  History,
  Scale,
  Building,
  LayoutTemplate,
  FileSignature,
  Home
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { cn } from '@/lib/utils';
import { SPADetails, PurposeRow, SecClause } from './types';
import { 
  RDO_LIST, 
  BIR_PURPOSES, 
  LGU_PURPOSES, 
  SSS_PURPOSES, 
  PHILHEALTH_PURPOSES, 
  PAGIBIG_PURPOSES,
  STLAF_REPRESENTATIVES 
} from './constants';
import { DocumentPreview } from './components/DocumentPreview';
import { SearchableSelect } from './components/SearchableSelect';
import { refinePurpose, extractSecClauses, getAIErrorMessage } from './lib/ai';

const paperSizeLabels: Record<string, string> = {
  legal: 'Legal (8.5" x 13")',
  a4: 'A4 Standard',
  letter: 'US Letter (8.5" x 11")'
};

const agencyLabels: Record<string, string> = {
  BIR: "BIR (Bureau of Internal Revenue)",
  SEC: "SEC (Securities and Exchange Commission)",
  LGU: "LGU (Local Government Unit)",
  SSS: "SSS",
  PhilHealth: "PhilHealth",
  "Pag-IBIG": "Pag-IBIG",
  Others: "Others"
};

const SEC_CORPS: Record<string, {name: string, address: string}[]> = {
  "Chris C. Tamesis": [
    { name: "WESTERN UNION FINANCIAL SERVICES (HONG KONG) LTD.", address: "Units NT1-1501 to 1512 , North Tower 1, EDSA corner North Avenue, Quezon City, Metro Manila, Philippines, 1100" },
    { name: "WESTERN UNION PROCESSING SERVICES, INC.", address: "Units NT1-1501 to 1512 , North Tower 1, EDSA corner North Avenue, Quezon City, Metro Manila, Philippines, 1100" },
    { name: "WESTERN UNION SERVICES (PHILIPPINES), INC.", address: "6th and 7th Floors, Vertis North Corporate Center Tower 1, North Avenue, Bagong Pagasa I, Quezon City, Philippines" }
  ],
  "Cheska Nicole Santiago": [
    { name: "RIB iTWO SOFTWARE, INC.", address: "Level 10-1 One Global Place, 5th Avenue corner 25th Street, Bonifacio Global City, Taguig City" },
    { name: "5D BIM PRODIGY TECHNOLOGY, INC.", address: "1017 Cityland Shaw Tower, Shaw Boulevard, Wack-Wack, Mandaluyong City" }
  ]
};

export default function App() {
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] = useState<'spa' | 'sec' | 'sec_dispute' | 'other' | null>(null);
  const [details, setDetails] = useState<SPADetails>({
    paperSize: 'legal',
    affiantName: '',
    nationality: 'Filipino',
    civilStatus: 'Single',
    address: '',
    representatives: STLAF_REPRESENTATIVES,
    idType: '',
    idNumber: '',
    purposes: [
      { id: crypto.randomUUID(), agency: '', text: '', suggestedPurpose: 'MANUAL', rdo: '', lgu: '' }
    ]
  });

  const [repType, setRepType] = useState<'stlaf' | 'manual'>('stlaf');
  const [activeTab, setActiveTab] = useState('principal');

  const [isRefining, setIsRefining] = useState<string | null>(null);
  const [activeRefineId, setActiveRefineId] = useState<string | null>(null);
  const [refineOptions, setRefineOptions] = useState<{ label: string, text: string }[]>([]);
  const [isRefineDialogOpen, setIsRefineDialogOpen] = useState(false);

  // SEC Feature State
  const [secSignatoryType, setSecSignatoryType] = useState<string>("");
  const [secManualSignatory, setSecManualSignatory] = useState<string>("");
  const [secCorpName, setSecCorpName] = useState<string>("");
  const [isManualCorp, setIsManualCorp] = useState(false);
  const [secCorpAddress, setSecCorpAddress] = useState<string>("");
  const [secMeetingType, setSecMeetingType] = useState<string>("");
  const [secMeetingDate, setSecMeetingDate] = useState<string>("");
  const [secHeadline, setSecHeadline] = useState("");
  const [secIdType, setSecIdType] = useState<string>("");
  const [secIdNumber, setSecIdNumber] = useState<string>("");
  const [secSignatoryCapacity, setSecSignatoryCapacity] = useState<string>("Corporate Secretary (Domestic)");
  const [secSignatoryAddress, setSecSignatoryAddress] = useState<string>("");
  const [secFileBase64, setSecFileBase64] = useState<string | null>(null);
  const [secFileMimeType, setSecFileMimeType] = useState<string | null>(null);
  const [secFileName, setSecFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedClauses, setExtractedClauses] = useState<SecClause[]>([]);
  const [isRefiningSec, setIsRefiningSec] = useState<string | null>(null);

  // Auto-increment clause type logic
  const getAutoClauseType = (index: number, total: number) => {
    if (index === 0) return "RESOLVED";
    if (index === total - 1 && total > 1) return "RESOLVED FINALLY";
    return "RESOLVED FURTHER";
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const handleExportPDF = () => {
    window.print();
  };

  const addPurpose = () => {
    setDetails(prev => ({
      ...prev,
      purposes: [...prev.purposes, { id: crypto.randomUUID(), agency: '', text: '', suggestedPurpose: 'MANUAL', rdo: '', lgu: '' }]
    }));
  };

  const removePurpose = (id: string) => {
    setDetails(prev => ({
      ...prev,
      purposes: prev.purposes.filter(p => p.id !== id)
    }));
  };

  const updatePurpose = (id: string, updates: Partial<PurposeRow>) => {
    setDetails(prev => ({
      ...prev,
      purposes: prev.purposes.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const handleRefine = async (purpose: PurposeRow) => {
    setIsRefining(purpose.id);
    setActiveRefineId(purpose.id);
    try {
      const options = await refinePurpose(purpose.text, purpose.agency, purpose.rdo || purpose.lgu);
      setRefineOptions(options);
      setIsRefineDialogOpen(true);
    } catch (error) {
      console.error("Failed to refine:", error);
      alert(getAIErrorMessage(error));
    } finally {
      setIsRefining(null);
    }
  };

  const applyRefinedText = (text: string) => {
    if (activeRefineId) {
      updatePurpose(activeRefineId, { text });
    }
    setIsRefineDialogOpen(false);
  };

  const getSuggestedPurposes = (agency: string) => {
    switch (agency) {
      case 'BIR': return BIR_PURPOSES;
      case 'LGU': return LGU_PURPOSES;
      case 'SSS': return SSS_PURPOSES;
      case 'PhilHealth': return PHILHEALTH_PURPOSES;
      case 'Pag-IBIG': return PAGIBIG_PURPOSES;
      default: return [];
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSecFileName(file.name);
    setSecFileMimeType(file.type);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setSecFileBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractSec = async () => {
    if (!secHeadline || !secFileBase64 || !secFileMimeType) return;
    
    setIsExtracting(true);
    setExtractedClauses([]); // Clear previous
    try {
      const results = await extractSecClauses(secHeadline, secFileBase64, secFileMimeType);
      
      if (!Array.isArray(results)) {
        throw new Error("Invalid response format from AI extractor. Expected an array of clauses.");
      }
      
      const mappedClauses: SecClause[] = results.map((res: any, idx: number) => {
        // 1. Aggressively clean the "RESOLVED" prefixes and redundant legal words
        let cleanText = res.text || "";
        
        // Multi-pass cleaning for nested/repeated prefixes like "RESOLVED FURTHER, FURTHER"
        const cleanPattern = /^(RESOLVED\s+FURTHER|RESOLVED\s+FINALLY|RESOLVED|FURTHER|FINALLY|THAT)[\s,:]+/gi;
        cleanText = cleanText.replace(cleanPattern, "");
        cleanText = cleanText.replace(cleanPattern, ""); // Second pass for double repeats
        
        // Strip any remaining leading punctuation or weird artifacts
        cleanText = cleanText.replace(/^[,\s:]+/, "").trim();
        
        // 2. Initial table sanitization
        let cleanTable = undefined;
        if (Array.isArray(res.tableData) && res.tableData.length > 0) {
          // Check if it's an array of arrays
          if (Array.isArray(res.tableData[0])) {
            // Check for 'null' placeholder
            if (res.tableData.length === 1 && res.tableData[0].length === 1 && String(res.tableData[0][0]).toLowerCase() === 'null') {
              cleanTable = undefined;
            } else {
              cleanTable = res.tableData;
            }
          }
        }
        
        return {
          id: Math.random().toString(36).substr(2, 9),
          type: getAutoClauseType(idx, results.length),
          text: cleanText,
          tableData: cleanTable
        };
      });

      // 3. Strict Deduplication Pass
      // If a table is identical to any previous table in the same document, it's likely a hallucination/repetition
      const finalClauses = mappedClauses.map((clause, idx) => {
        if (!clause.tableData) return clause;
        
        const currentTableStr = JSON.stringify(clause.tableData);
        for (let i = 0; i < idx; i++) {
          if (mappedClauses[i].tableData && JSON.stringify(mappedClauses[i].tableData) === currentTableStr) {
            console.log(`Deduplicated identical table found at index ${idx}`);
            return { ...clause, tableData: undefined };
          }
        }
        return clause;
      });

      setExtractedClauses(finalClauses);
      if (results.length === 0) {
        alert("No RESOLVED clauses found under that headline in the uploaded document.");
      }
    } catch (error) {
      console.error(error);
      alert(getAIErrorMessage(error));
    } finally {
      setIsExtracting(false);
    }
  };

  const addSecClause = () => {
    const newClauses = [...extractedClauses];
    const newClause: SecClause = {
      id: Math.random().toString(36).substr(2, 9),
      type: getAutoClauseType(newClauses.length, newClauses.length + 1),
      text: ""
    };
    newClauses.push(newClause);
    
    // Recalculate types for all to keep sequence correct
    const updated = newClauses.map((c, idx) => ({
      ...c,
      type: getAutoClauseType(idx, newClauses.length)
    }));
    setExtractedClauses(updated);
  };

  const removeSecClause = (id: string) => {
    const filtered = extractedClauses.filter(c => c.id !== id);
    const updated = filtered.map((c, idx) => ({
      ...c,
      type: getAutoClauseType(idx, filtered.length)
    }));
    setExtractedClauses(updated);
  };

  const updateSecClause = (id: string, field: keyof SecClause, value: any) => {
    setExtractedClauses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const updateSecTableData = (clauseId: string, rowIndex: number, colIndex: number, value: string) => {
    setExtractedClauses(prev => prev.map(c => {
      if (c.id !== clauseId || !c.tableData) return c;
      const newTable = [...c.tableData];
      newTable[rowIndex] = [...newTable[rowIndex]];
      newTable[rowIndex][colIndex] = value;
      return { ...c, tableData: newTable };
    }));
  };

  const addSecTableRow = (clauseId: string) => {
    setExtractedClauses(prev => prev.map(c => {
      if (c.id !== clauseId) return c;
      const currentTable = c.tableData || [['', '']];
      const colCount = currentTable[0]?.length || 2;
      const newRow = Array(colCount).fill('');
      return { ...c, tableData: [...currentTable, newRow] };
    }));
  };

  const addSecTableCol = (clauseId: string) => {
    setExtractedClauses(prev => prev.map(c => {
      if (c.id !== clauseId) return c;
      const currentTable = c.tableData || [['', '']];
      const newTable = currentTable.map(row => [...row, '']);
      return { ...c, tableData: newTable };
    }));
  };

  const handleRefineSecClause = async (clause: SecClause) => {
    if (!clause.text) return;
    setIsRefiningSec(clause.id);
    try {
      const results = await refinePurpose(clause.text, "SEC", ""); // Using refinement service
      if (Array.isArray(results) && results.length > 0) {
        updateSecClause(clause.id, 'text', results[0].text);
      }
    } catch (error) {
      console.error("Refiner Error:", error);
      alert(getAIErrorMessage(error));
    } finally {
      setIsRefiningSec(null);
    }
  };

  const clearAllForms = () => {
    // Reset SPA Details
    setDetails({
      paperSize: 'legal',
      affiantName: '',
      nationality: 'Filipino',
      civilStatus: 'Single',
      address: '',
      representatives: STLAF_REPRESENTATIVES,
      idType: '',
      idNumber: '',
      purposes: [
        { id: crypto.randomUUID(), agency: '', text: '', suggestedPurpose: 'MANUAL', rdo: '', lgu: '' }
      ]
    });
    setRepType('stlaf');
    setActiveTab('principal');

    // Reset SEC Details
    setSecSignatoryType("");
    setSecManualSignatory("");
    setSecCorpName("");
    setIsManualCorp(false);
    setSecCorpAddress("");
    setSecMeetingType("");
    setSecMeetingDate("");
    setSecHeadline("");
    setSecIdType("");
    setSecIdNumber("");
    setSecSignatoryCapacity("Corporate Secretary (Domestic)");
    setSecSignatoryAddress("");
    setSecFileBase64(null);
    setSecFileMimeType(null);
    setSecFileName(null);
    setExtractedClauses([]);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col font-inter print:bg-white">
      {/* Navbar */}
      <nav className="bg-[#123765] text-white p-4 border-b-4 border-[#ccaa49] flex justify-between items-center shadow-lg sticky top-0 z-50 no-print">
        <div className="flex items-center gap-3">
          <div className="bg-transparent p-1 rounded">
            <img 
              src="/home.png" 
              alt="STLAF Logo" 
              className="w-10 h-10 object-contain" 
            />
          </div>
          <div>
            <div className="font-bold text-xl tracking-wider">STLAF <span className="text-[#ccaa49]">| CORPORATE</span></div>
            <div className="text-[10px] opacity-70 uppercase tracking-tighter">Sadsad Tamesis Legal and Accountancy Firm</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {step !== 1 && (
            <Button 
              variant="default" 
              onClick={() => {
                setStep(1);
                setDocumentType(null);
              }}
              className="bg-white/10 hover:bg-white/20 text-white border-none gap-2 px-4 shadow-sm backdrop-blur-sm"
            >
              <Home size={18} />
              <span className="hidden sm:inline font-bold uppercase text-[10px] tracking-widest">Home</span>
            </Button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center no-print max-w-5xl mx-auto w-full"
            >
              <div className="w-full max-w-3xl mb-12">
                <img src="/main3.png" alt="STLAF Corporate Drafting" className="w-full h-auto object-contain" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4">
                <button
                  onClick={() => {
                    clearAllForms();
                    setDocumentType('spa');
                    setStep(2);
                    setActiveTab('principal');
                  }}
                  className="group flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-[#ccaa49] hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="w-20 h-20 rounded-full bg-[#123765]/5 text-[#123765] flex items-center justify-center mb-6 group-hover:bg-[#123765] group-hover:text-white transition-colors">
                    <FileSignature size={36} />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#123765] mb-2 uppercase tracking-tight">SPA Draft</h3>
                  <p className="text-sm text-slate-500 font-medium">Special Power of Attorney drafting tailored for STLAF matters.</p>
                </button>

                <button
                  onClick={() => {
                    clearAllForms();
                    setDocumentType('sec');
                    setStep(2);
                  }}
                  className="group flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-[#ccaa49] hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="w-20 h-20 rounded-full bg-[#123765]/5 text-[#123765] flex items-center justify-center mb-6 group-hover:bg-[#123765] group-hover:text-white transition-colors">
                    <Building size={36} />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#123765] mb-2 uppercase tracking-tight">SEC Cert Standard</h3>
                  <p className="text-sm text-slate-500 font-medium">Drafting tool for standard SEC Certificates and documentation.</p>
                </button>

                <button
                  onClick={() => {
                    clearAllForms();
                    setDocumentType('sec_dispute');
                    setStep(2);
                  }}
                  className="group flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-[#ccaa49] hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="w-20 h-20 rounded-full bg-[#123765]/5 text-[#123765] flex items-center justify-center mb-6 group-hover:bg-[#123765] group-hover:text-white transition-colors">
                    <Scale size={36} />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#123765] mb-2 uppercase tracking-tight">SEC Cert (No Dispute)</h3>
                  <p className="text-sm text-slate-500 font-medium">Form for Certification of No Intra-Corporate Dispute.</p>
                </button>

                <button
                  disabled
                  className="group flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 opacity-60 cursor-not-allowed"
                >
                  <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center mb-6 text-slate-400">
                    <LayoutTemplate size={36} />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-500 mb-2 uppercase tracking-tight">Additional Forms</h3>
                  <p className="text-sm text-slate-400 font-medium">More drafting templates arriving in future updates.</p>
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && documentType === 'spa' && (
            <motion.div 
              key="details_spa"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 max-w-6xl mx-auto w-full flex gap-8 no-print"
            >
              {/* Sidebar Navigation */}
              <div className="w-64 shrink-0 space-y-2 hidden lg:block">
                <button 
                  onClick={() => setActiveTab('principal')}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                    activeTab === 'principal' ? "bg-[#123765] text-white shadow-md" : "hover:bg-white/50 text-slate-600"
                  )}
                >
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px]", activeTab === 'principal' ? "bg-[#ccaa49]" : "bg-slate-200")}>1</div>
                  Principal Details
                </button>
                <button 
                  onClick={() => setActiveTab('representatives')}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                    activeTab === 'representatives' ? "bg-[#123765] text-white shadow-md" : "hover:bg-white/50 text-slate-600"
                  )}
                >
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px]", activeTab === 'representatives' ? "bg-[#ccaa49]" : "bg-slate-200")}>2</div>
                  Authorized Representatives
                </button>
                <button 
                  onClick={() => setActiveTab('scope')}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                    activeTab === 'scope' ? "bg-[#123765] text-white shadow-md" : "hover:bg-white/50 text-slate-600"
                  )}
                >
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px]", activeTab === 'scope' ? "bg-[#ccaa49]" : "bg-slate-200")}>3</div>
                  Scope of Authority
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                    step === 3 ? "bg-[#123765] text-white shadow-md" : "hover:bg-white/50 text-slate-600"
                  )}
                >
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px]", step === 3 ? "bg-[#ccaa49]" : "bg-slate-200")}>4</div>
                  Review & Export
                </button>
                <div className="pt-8">
                  <Button 
                    className="w-full bg-[#ccaa49] hover:bg-[#b8983d] text-white gap-2"
                    onClick={() => setStep(3)}
                  >
                    Preview Document <ChevronRight size={18} />
                  </Button>
                </div>
              </div>

              <Card className="flex-1 border-none shadow-xl overflow-visible">
                <CardHeader className="bg-white border-b border-muted p-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#ccaa49] animate-pulse"></div>
                        <span className="text-[10px] font-bold uppercase text-[#ccaa49] tracking-widest">Active Drafting Session</span>
                      </div>
                      <CardTitle className="text-[#123765] text-2xl uppercase tracking-tight font-extrabold">
                        {activeTab === 'principal' && "Principal Information"}
                        {activeTab === 'representatives' && "Authorized Representatives"}
                        {activeTab === 'scope' && "Scope of Authority"}
                      </CardTitle>
                      <CardDescription className="text-slate-500 italic text-sm">
                        {activeTab === 'principal' && "Enter the legal details of the individual granting the power of attorney."}
                        {activeTab === 'representatives' && "Specify the legal entities or individuals authorized to act as attorney-in-fact."}
                        {activeTab === 'scope' && "Define the specific legal acts, agencies, and jurisdictions covered by this authority."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  {activeTab === 'principal' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Document Paper Format</Label>
                          <Select 
                            value={details.paperSize} 
                            onValueChange={(v: any) => setDetails(prev => ({ ...prev, paperSize: v }))}
                          >
                            <SelectTrigger className="min-h-12 h-auto border-slate-200">
                              <SelectValue placeholder="Select size">
                                {details.paperSize ? paperSizeLabels[details.paperSize] : "Select size"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="legal">Legal (8.5" x 13")</SelectItem>
                              <SelectItem value="a4">A4 Standard</SelectItem>
                              <SelectItem value="letter">US Letter (8.5" x 11")</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Full Name of Principal (Affiant)</Label>
                          <Input 
                            className="h-12 border-slate-200"
                            placeholder="e.g., JUAN P. DELA CRUZ" 
                            value={details.affiantName}
                            onChange={e => setDetails(prev => ({ ...prev, affiantName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Nationality</Label>
                          <Input 
                            className="h-12 border-slate-200"
                            value={details.nationality}
                            onChange={e => setDetails(prev => ({ ...prev, nationality: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Civil Status</Label>
                          <Select 
                            value={details.civilStatus} 
                            onValueChange={v => setDetails(prev => ({ ...prev, civilStatus: v }))}
                          >
                            <SelectTrigger className="min-h-12 h-auto border-slate-200">
                              <SelectValue placeholder="Select status">
                                {details.civilStatus || "Select status"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Single">Single</SelectItem>
                              <SelectItem value="Married">Married</SelectItem>
                              <SelectItem value="Widowed">Widowed</SelectItem>
                              <SelectItem value="Legally Separated">Legally Separated</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Complete Residence Address</Label>
                          <Input 
                            className="h-12 border-slate-200"
                            placeholder="Unit, Building, Street, Brgy, City, Province" 
                            value={details.address}
                            onChange={e => setDetails(prev => ({ ...prev, address: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Competent Evidence of Identity</Label>
                          <Input 
                            className="h-12 border-slate-200"
                            placeholder="e.g., Philippine Passport" 
                            value={details.idType}
                            onChange={e => setDetails(prev => ({ ...prev, idType: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Identification Number</Label>
                          <Input 
                            className="h-12 border-slate-200"
                            placeholder="e.g., P1234567A" 
                            value={details.idNumber}
                            onChange={e => setDetails(prev => ({ ...prev, idNumber: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-4">
                        <Button onClick={() => setActiveTab('representatives')} className="bg-[#123765] hover:bg-[#0d2a4d] text-white px-8 py-5 text-md shadow-md rounded-lg transition-all group">
                          Next: Representatives <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'representatives' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Authorized Representative Selection</Label>
                          <Select 
                            value={repType === 'stlaf' ? STLAF_REPRESENTATIVES : 'manual'} 
                            onValueChange={(v: string) => {
                              if (v === STLAF_REPRESENTATIVES) {
                                setRepType('stlaf');
                                setDetails(prev => ({ ...prev, representatives: STLAF_REPRESENTATIVES }));
                              } else {
                                setRepType('manual');
                                setDetails(prev => ({ ...prev, representatives: '' }));
                              }
                            }}
                          >
                            <SelectTrigger className="min-h-12 h-auto border-slate-200 bg-white">
                              <SelectValue placeholder="Choose Representatives...">
                                {repType === 'stlaf' ? 'STLAF Authorized Representatives (Corporate Department)' : 'Manual Input / Custom Representatives'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={STLAF_REPRESENTATIVES}>STLAF Authorized Representatives (Corporate Department)</SelectItem>
                              <SelectItem value="manual">Manual Input / Custom Representatives</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-400 italic">Select the pre-defined STLAF Corporate Department list or enter custom representatives manually.</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Representative Details</Label>
                          <Textarea 
                            className={cn(
                              "min-h-[150px] border-slate-200 leading-relaxed transition-all",
                              repType === 'stlaf' ? "bg-slate-50 text-slate-500 italic" : "bg-white"
                            )}
                            placeholder="Enter names of authorized individuals..."
                            value={details.representatives}
                            onChange={e => setDetails(prev => ({ ...prev, representatives: e.target.value }))}
                            readOnly={repType === 'stlaf'}
                          />
                          {repType === 'stlaf' && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 italic mt-1">
                              <Scale size={10} />
                              <span>Standard STLAF Corporate Department representatives selected.</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <Button variant="ghost" onClick={() => setActiveTab('principal')} className="text-slate-600 hover:text-[#123765] h-10 px-4">
                          <ChevronLeft size={18} className="mr-2" /> Back to Principal
                        </Button>
                        <Button onClick={() => setActiveTab('scope')} className="bg-[#123765] hover:bg-[#0d2a4d] text-white px-8 py-5 text-md shadow-md rounded-lg transition-all group">
                          Next: Scope of Authority <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'scope' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-48">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[#123765] font-bold uppercase tracking-widest text-[10px]">Authorization Items</h3>
                        </div>

                        <div className="space-y-6">
                          {details.purposes.map((purpose, index) => (
                            <Card key={purpose.id} className="border-none bg-slate-50/50 shadow-sm overflow-visible text-left">
                              <div className="bg-[#123765]/5 px-6 py-2 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#123765] uppercase tracking-widest">Authority Item #{index + 1}</span>
                                {details.purposes.length > 1 && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-destructive transition-colors"
                                    onClick={() => removePurpose(purpose.id)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                )}
                              </div>
                              <CardContent className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Target Agency / Entity</Label>
                                    <Select 
                                      value={purpose.agency} 
                                      onValueChange={v => updatePurpose(purpose.id, { agency: v, suggestedPurpose: 'MANUAL' })}
                                    >
                                      <SelectTrigger className="min-h-12 h-auto bg-white border-slate-200">
                                        <SelectValue placeholder="Select Agency">
                                          {purpose.agency ? agencyLabels[purpose.agency] : "Select Agency"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="BIR">BIR (Bureau of Internal Revenue)</SelectItem>
                                        <SelectItem value="SEC">SEC (Securities and Exchange Commission)</SelectItem>
                                        <SelectItem value="LGU">LGU (Local Government Unit)</SelectItem>
                                        <SelectItem value="SSS">SSS</SelectItem>
                                        <SelectItem value="PhilHealth">PhilHealth</SelectItem>
                                        <SelectItem value="Pag-IBIG">Pag-IBIG</SelectItem>
                                        <SelectItem value="Others">Others</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Standard Legal Templates</Label>
                                    <SearchableSelect 
                                      value={purpose.suggestedPurpose} 
                                      onValueChange={v => {
                                        updatePurpose(purpose.id, { suggestedPurpose: v, text: v === 'MANUAL' ? purpose.text : v });
                                      }}
                                      options={[
                                        { value: 'MANUAL', label: 'Custom Entry' },
                                        ...getSuggestedPurposes(purpose.agency).map(p => ({
                                          value: p.text,
                                          label: p.key,
                                          description: p.text
                                        }))
                                      ]}
                                      placeholder="Select Template"
                                      searchPlaceholder="Search templates..."
                                    />
                                  </div>

                                  {purpose.agency === 'BIR' && (
                                    <div className="space-y-2 md:col-span-2">
                                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Revenue District Office (RDO)</Label>
                                      <SearchableSelect 
                                        value={purpose.rdo || ""} 
                                        onValueChange={v => updatePurpose(purpose.id, { rdo: v })}
                                        options={RDO_LIST}
                                        placeholder="Search and Select RDO..."
                                        searchPlaceholder="Search RDO code or location..."
                                      />
                                    </div>
                                  )}

                                  {purpose.agency === 'LGU' && (
                                    <div className="space-y-2 md:col-span-2">
                                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Specify LGU Jurisdiction</Label>
                                      <Input 
                                        className="h-12 bg-white border-slate-200"
                                        placeholder="e.g., Makati City" 
                                        value={purpose.lgu}
                                        onChange={e => updatePurpose(purpose.id, { lgu: e.target.value })}
                                      />
                                    </div>
                                  )}
                                </div>

                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Authorization Provisions</Label>
                                    <Textarea 
                                      placeholder="Define specific legal acts..."
                                      value={purpose.text}
                                      onChange={e => updatePurpose(purpose.id, { text: e.target.value })}
                                      className="min-h-[100px] bg-white border-slate-200 leading-relaxed"
                                    />
                                    <div className="flex justify-between items-center">
                                      <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        className="bg-[#fff9e6] text-[#b8983d] hover:bg-[#ccaa49] hover:text-white border border-[#ccaa49] rounded-full px-4 h-8 text-[10px] font-bold uppercase tracking-wider transition-all"
                                        onClick={() => {
                                          setIsRefining(purpose.id);
                                          handleRefine(purpose);
                                        }}
                                        disabled={!purpose.text || isRefining === purpose.id}
                                      >
                                        <Sparkles size={12} className="mr-2" />
                                        {isRefining === purpose.id ? 'Refining Legal Text...' : 'AI Legal Refiner'}
                                      </Button>
                                      {purpose.text.length > 50 && (
                                        <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                                          <Scale size={10} />
                                          <span>Review-Ready Standard</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                              </CardContent>
                            </Card>
                          ))}
                          
                          <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Button 
                              onClick={addPurpose} 
                              variant="outline" 
                              className="w-full py-8 border-2 border-dashed border-[#ccaa49]/30 text-[#ccaa49] hover:bg-[#ccaa49]/5 hover:border-[#ccaa49] transition-all font-bold uppercase text-xs tracking-widest gap-2 bg-white/50"
                            >
                              <Plus size={20} className="text-[#ccaa49]" />
                              Add Another Authorization Clause
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <Button variant="ghost" onClick={() => setActiveTab('representatives')} className="text-slate-600 hover:text-[#123765] h-10 px-4">
                          <ChevronLeft size={18} className="mr-2" /> Back to Representatives
                        </Button>
                        <Button 
                          className="bg-[#123765] hover:bg-[#0d2a4d] text-white px-8 py-5 text-md shadow-md rounded-lg transition-all group"
                          onClick={() => setStep(3)}
                        >
                          Finalize Document & Review <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && documentType === 'sec' && (
            <motion.div 
              key="details_sec"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 max-w-6xl mx-auto w-full flex flex-col no-print gap-8"
            >
              <Card className="border-none shadow-xl overflow-visible max-w-3xl mx-auto w-full">
                <CardHeader className="bg-white border-b border-muted p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#123765]/5 text-[#123765] flex items-center justify-center">
                      <Building size={32} />
                    </div>
                    <div>
                      <CardTitle className="text-[#123765] text-2xl uppercase tracking-tight font-extrabold flex items-center gap-2">
                        Secretary's Certificate Drafting <Sparkles className="text-[#ccaa49]" size={20} />
                      </CardTitle>
                      <CardDescription className="text-slate-500 italic text-sm">
                        Professional drafting of Board Resolutions and Secretary's Certificates with AI-powered clause extraction.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Signatory Name</Label>
                      <Select 
                        value={secSignatoryType} 
                        onValueChange={(val) => {
                          setSecSignatoryType(val);
                          setSecCorpName("");
                          setSecIdType("");
                          setSecIdNumber("");
                          setIsManualCorp(false);
                          setSecCorpAddress("");
                          if (val === "Chris C. Tamesis") {
                            setSecSignatoryAddress("7th Floor Victoria Sports Tower Station II EDSA South Triangle District 4, Quezon City, 1103, Philippines");
                            setSecSignatoryCapacity("Corporate Secretary (Domestic)");
                          } else if (val === "Cheska Nicole Santiago") {
                            setSecSignatoryAddress("7th Floor Victoria Sports Tower Station II EDSA South Triangle District 4, Quezon City, 1103, Philippines");
                            setSecSignatoryCapacity("Corporate Secretary (Domestic)");
                          } else {
                            setSecSignatoryAddress("");
                          }
                          if (val !== 'Others (Manual Input)') {
                            setSecManualSignatory("");
                          }
                        }}
                      >
                        <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                          <SelectValue placeholder="Select Signatory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Chris C. Tamesis">Chris C. Tamesis</SelectItem>
                          <SelectItem value="Cheska Nicole Santiago">Cheska Nicole Santiago</SelectItem>
                          <SelectItem value="Others (Manual Input)">Others (Manual Input)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {secSignatoryType === 'Others (Manual Input)' ? (
                      <div className="space-y-2">
                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Enter Signatory Name</Label>
                        <Input 
                          placeholder="e.g. Juan Dela Cruz" 
                          className="h-12 border-slate-200"
                          value={secManualSignatory}
                          onChange={(e) => setSecManualSignatory(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="hidden md:block"></div>
                    )}

                    {secSignatoryType === 'Others (Manual Input)' || !secSignatoryType || isManualCorp ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Corporate Name</Label>
                        <Input 
                          placeholder="Enter Corporate Name" 
                          className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                          value={secCorpName}
                          onChange={(e) => setSecCorpName(e.target.value)}
                        />
                        {isManualCorp && (
                           <Button 
                             variant="link" 
                             className="p-0 h-auto text-[10px] text-slate-400"
                             onClick={() => {
                               setIsManualCorp(false);
                               setSecCorpName("");
                             }}
                           >
                             Return to list
                           </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Select Corporate Name</Label>
                        <Select 
                          value={secCorpName} 
                          onValueChange={(val) => {
                            if (val === 'others') {
                              setIsManualCorp(true);
                              setSecCorpName("");
                              setSecCorpAddress("");
                            } else {
                              setSecCorpName(val);
                              const corp = SEC_CORPS[secSignatoryType]?.find(c => c.name === val);
                              if (corp) {
                                setSecCorpAddress(corp.address);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                            <SelectValue placeholder="Select Corporation" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEC_CORPS[secSignatoryType]?.map((corp, idx) => (
                              <SelectItem key={idx} value={corp.name}>
                                {corp.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="others">Others (Manual Input)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Principal Office Address OF CORPORATION</Label>
                      <Textarea 
                        placeholder="Complete principal office address of the corporation"
                        className={cn(
                          "min-h-[80px] border-slate-200 leading-relaxed focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all",
                          (!isManualCorp && secSignatoryType !== '' && secSignatoryType !== 'Others (Manual Input)' && secCorpName !== '') ? "bg-slate-50 text-slate-500" : "bg-white"
                        )}
                        value={secCorpAddress}
                        onChange={(e) => setSecCorpAddress(e.target.value)}
                        readOnly={!isManualCorp && secSignatoryType !== '' && secSignatoryType !== 'Others (Manual Input)' && secCorpName !== ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Signatory Capacity</Label>
                      <Select 
                        value={secSignatoryCapacity} 
                        onValueChange={setSecSignatoryCapacity}
                      >
                        <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                          <SelectValue placeholder="Select Capacity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Corporate Secretary (Domestic)">Corporate Secretary (Domestic)</SelectItem>
                          <SelectItem value="Resident Agent (Foreign)">Resident Agent (Foreign)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Signatory Office Address</Label>
                      <Input 
                        placeholder="Enter Signatory's Office Address" 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secSignatoryAddress}
                        onChange={(e) => setSecSignatoryAddress(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Type of Meeting</Label>
                      <Select 
                        value={secMeetingType} 
                        onValueChange={setSecMeetingType}
                      >
                        <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                          <SelectValue placeholder="Select Meeting Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Special">Special Meeting</SelectItem>
                          <SelectItem value="Annual">Annual Meeting</SelectItem>
                          <SelectItem value="Regular">Regular Meeting</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Meeting Date</Label>
                      <Input 
                        type="date"
                        className="h-12 border-slate-200"
                        value={secMeetingDate}
                        onChange={(e) => setSecMeetingDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Valid ID</Label>
                      <Input 
                        placeholder="e.g., Philippine Passport" 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secIdType}
                        onChange={(e) => setSecIdType(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">ID Number</Label>
                      <Input 
                        placeholder="e.g., P1234567A" 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secIdNumber}
                        onChange={(e) => setSecIdNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">
                        Agenda Headline
                      </Label>
                      <Input 
                        placeholder="e.g. Election of Officers, Re-routing of bank accounts..." 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secHeadline}
                        onChange={(e) => setSecHeadline(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleExtractSec();
                          }
                        }}
                      />
                      <p className="text-[10px] text-slate-400 italic">
                        Type the exact or approximate headline in the minutes to extract corresponding resolved clauses. Press Enter to submit.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">
                        Upload Minutes Document
                      </Label>
                      <div className="flex items-center gap-4">
                        <Input 
                          type="file" 
                          id="minutes-upload"
                          className="hidden"
                          accept="application/pdf,image/*,text/plain"
                          onChange={handleFileUpload}
                        />
                        <Button 
                          variant="outline" 
                          className="h-12 border-dashed border-2 border-slate-300 w-full hover:bg-slate-50 gap-2 justify-start px-4 text-slate-600"
                          onClick={() => document.getElementById('minutes-upload')?.click()}
                        >
                          <FileText size={18} className="text-[#ccaa49]" />
                          {secFileName || "Select PDF or Image..."}
                        </Button>
                      </div>
                    </div>

                    <Button 
                      className="w-full bg-[#123765] hover:bg-[#0d2a4d] text-white py-6 shadow-md transition-all uppercase tracking-widest text-xs font-bold gap-2"
                      onClick={handleExtractSec}
                      disabled={isExtracting || !secHeadline || !secFileBase64}
                    >
                      {isExtracting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Extracting Clauses...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Extract SEC Cert Clauses
                        </>
                      )}
                    </Button>
                  </div>

                  {extractedClauses.length > 0 && (
                    <div className="pt-8 border-t border-slate-100 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-[#123765] font-bold uppercase text-[14px] tracking-tight">Resolution Clauses</h3>
                      
                      <div className="space-y-4">
                        {extractedClauses?.map((clause, idx) => (
                          <motion.div 
                            key={clause.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <Card className="relative overflow-hidden border-slate-200 border-l-4 border-l-[#ccaa49] bg-white shadow-sm ring-1 ring-slate-200/50">
                              <CardContent className="p-6 pb-4 space-y-4">
                                <div className="absolute top-2 right-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    onClick={() => removeSecClause(clause.id)}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Clause Type</Label>
                                    <Select 
                                      value={clause.type} 
                                      onValueChange={(val) => updateSecClause(clause.id, 'type', val)}
                                    >
                                      <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                                        <SelectItem value="RESOLVED FURTHER">RESOLVED FURTHER</SelectItem>
                                        <SelectItem value="RESOLVED FINALLY">RESOLVED FINALLY</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Resolved Clause Text</Label>
                                    <Textarea 
                                      placeholder="That the Board of Directors approved..." 
                                      className="min-h-[120px] border-slate-200 leading-relaxed focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                                      value={clause.text}
                                      onChange={(e) => updateSecClause(clause.id, 'text', e.target.value)}
                                    />
                                  </div>

                                  {Array.isArray(clause.tableData) && clause.tableData.length > 0 && Array.isArray(clause.tableData[0]) && clause.tableData[0][0] !== "null" && (
                                    <div className="space-y-2 pt-2">
                                      <div className="flex justify-between items-center mb-2">
                                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Resolution Table Data</Label>
                                        <div className="flex gap-2">
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 text-[10px] uppercase font-bold"
                                            onClick={() => addSecTableRow(clause.id)}
                                          >
                                            + Row
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 text-[10px] uppercase font-bold"
                                            onClick={() => addSecTableCol(clause.id)}
                                          >
                                            + Col
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-[10px] uppercase font-bold text-red-500 hover:bg-red-50"
                                            onClick={() => updateSecClause(clause.id, 'tableData', undefined)}
                                          >
                                            Remove Table
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50/30">
                                        <table className="w-full border-collapse">
                                          <tbody>
                                            {clause.tableData?.map((row, rIdx) => (
                                              <tr key={rIdx} className="border-b border-slate-100 last:border-0">
                                                {Array.isArray(row) && row.map((cell, cIdx) => (
                                                  <td key={cIdx} className="p-1 border-r border-slate-100 last:border-0 min-w-[120px]">
                                                    <Input 
                                                      value={cell}
                                                      onChange={(e) => updateSecTableData(clause.id, rIdx, cIdx, e.target.value)}
                                                      className="border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#123765]/30 h-8 text-sm bg-transparent px-2"
                                                    />
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {!clause.tableData && clause.text.trim().endsWith(':') && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full border-dashed border-slate-300 text-slate-400 hover:text-[#123765] hover:border-[#123765]/30 h-10"
                                      onClick={() => updateSecClause(clause.id, 'tableData', [['Header 1', 'Header 2'], ['', '']])}
                                    >
                                      <Plus size={14} className="mr-2" /> Detected colon. Add resolution table?
                                    </Button>
                                  )}

                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-full border-[#123765]/10 text-[#123765] hover:bg-[#123765]/5 transition-all text-[11px] font-medium gap-2 px-3 bg-slate-50/50"
                                        onClick={() => handleRefineSecClause(clause)}
                                        disabled={isRefiningSec === clause.id || !clause.text}
                                      >
                                        {isRefiningSec === clause.id ? (
                                          <div className="h-3 w-3 border-2 border-[#123765] border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Sparkles size={14} className="text-[#ccaa49]" />
                                        )}
                                        {isRefiningSec === clause.id ? 'Refining...' : 'AI Refiner'}
                                      </Button>

                                      {!clause.tableData && !clause.text.trim().endsWith(':') && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 text-[11px] text-slate-400 hover:text-[#123765] px-2 shadow-none"
                                          onClick={() => updateSecClause(clause.id, 'tableData', [['Header 1', 'Header 2'], ['', '']])}
                                        >
                                          <Plus size={14} className="mr-1" /> Add Table
                                        </Button>
                                      )}
                                    </div>

                                    {idx === extractedClauses.length - 1 && (
                                      <Button 
                                        variant="outline"
                                        size="sm"
                                        className="h-9 border-[#123765] text-[#123765] hover:bg-[#123765]/5 font-bold uppercase text-[10px] tracking-widest gap-2"
                                        onClick={addSecClause}
                                      >
                                        <Plus size={14} /> Add Clause
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-8">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setStep(1);
                        setDocumentType(null);
                      }} 
                      className="text-slate-600 hover:text-[#123765] h-10 px-4"
                    >
                      <ChevronLeft size={18} className="mr-2" /> Back to Document Selection
                    </Button>
                    <Button 
                      className="bg-[#123765] hover:bg-[#0d2a4d] text-white px-8 py-5 text-md shadow-md rounded-lg transition-all group"
                      onClick={() => setStep(3)}
                    >
                      Finalize Document & Review <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && documentType === 'sec_dispute' && (
            <motion.div 
              key="details_sec_dispute"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 max-w-6xl mx-auto w-full flex flex-col no-print gap-8"
            >
              <Card className="border-none shadow-xl overflow-visible max-w-3xl mx-auto w-full">
                <CardHeader className="bg-white border-b border-muted p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#123765]/5 text-[#123765] flex items-center justify-center">
                      <Scale size={32} />
                    </div>
                    <div>
                      <CardTitle className="text-[#123765] text-2xl uppercase tracking-tight font-extrabold flex items-center gap-2">
                        No Intra-Corporate Dispute Drafting <Sparkles className="text-[#ccaa49]" size={20} />
                      </CardTitle>
                      <CardDescription className="text-slate-500 italic text-sm">
                        Professional drafting of Certification of No Intra-Corporate Dispute.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Signatory Name</Label>
                      <Select 
                        value={secSignatoryType} 
                        onValueChange={(val) => {
                          setSecSignatoryType(val);
                          setSecCorpName("");
                          setSecIdType("");
                          setSecIdNumber("");
                          setIsManualCorp(false);
                          setSecCorpAddress("");
                          if (val === "Chris C. Tamesis") {
                            setSecSignatoryAddress("7th Floor Victoria Sports Tower Station II EDSA South Triangle District 4, Quezon City, 1103, Philippines");
                            setSecSignatoryCapacity("Corporate Secretary (Domestic)");
                          } else if (val === "Cheska Nicole Santiago") {
                            setSecSignatoryAddress("7th Floor Victoria Sports Tower Station II EDSA South Triangle District 4, Quezon City, 1103, Philippines");
                            setSecSignatoryCapacity("Corporate Secretary (Domestic)");
                          } else {
                            setSecSignatoryAddress("");
                          }
                          if (val !== 'Others (Manual Input)') {
                            setSecManualSignatory("");
                          }
                        }}
                      >
                        <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                          <SelectValue placeholder="Select Signatory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Chris C. Tamesis">Chris C. Tamesis</SelectItem>
                          <SelectItem value="Cheska Nicole Santiago">Cheska Nicole Santiago</SelectItem>
                          <SelectItem value="Others (Manual Input)">Others (Manual Input)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {secSignatoryType === 'Others (Manual Input)' ? (
                      <div className="space-y-2">
                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Enter Signatory Name</Label>
                        <Input 
                          placeholder="e.g. Juan Dela Cruz" 
                          className="h-12 border-slate-200"
                          value={secManualSignatory}
                          onChange={(e) => setSecManualSignatory(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="hidden md:block"></div>
                    )}

                    {secSignatoryType === 'Others (Manual Input)' || !secSignatoryType || isManualCorp ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Corporate Name</Label>
                        <Input 
                          placeholder="Enter Corporate Name" 
                          className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                          value={secCorpName}
                          onChange={(e) => setSecCorpName(e.target.value)}
                        />
                        {isManualCorp && (
                           <Button 
                             variant="link" 
                             className="p-0 h-auto text-[10px] text-slate-400"
                             onClick={() => {
                               setIsManualCorp(false);
                               setSecCorpName("");
                             }}
                           >
                             Return to list
                           </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Select Corporate Name</Label>
                        <Select 
                          value={secCorpName} 
                          onValueChange={(val) => {
                            if (val === 'others') {
                              setIsManualCorp(true);
                              setSecCorpName("");
                              setSecCorpAddress("");
                            } else {
                              setSecCorpName(val);
                              const corp = SEC_CORPS[secSignatoryType]?.find(c => c.name === val);
                              if (corp) {
                                setSecCorpAddress(corp.address);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                            <SelectValue placeholder="Select Corporation" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEC_CORPS[secSignatoryType]?.map((corp, idx) => (
                              <SelectItem key={idx} value={corp.name}>
                                {corp.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="others">Others (Manual Input)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Principal Office Address OF CORPORATION</Label>
                      <Textarea 
                        placeholder="Complete principal office address of the corporation"
                        className={cn(
                          "min-h-[80px] border-slate-200 leading-relaxed focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all",
                          (!isManualCorp && secSignatoryType !== '' && secSignatoryType !== 'Others (Manual Input)' && secCorpName !== '') ? "bg-slate-50 text-slate-500" : "bg-white"
                        )}
                        value={secCorpAddress}
                        onChange={(e) => setSecCorpAddress(e.target.value)}
                        readOnly={!isManualCorp && secSignatoryType !== '' && secSignatoryType !== 'Others (Manual Input)' && secCorpName !== ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Signatory Capacity</Label>
                      <Select 
                        value={secSignatoryCapacity} 
                        onValueChange={setSecSignatoryCapacity}
                      >
                        <SelectTrigger className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all">
                          <SelectValue placeholder="Select Capacity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Corporate Secretary (Domestic)">Corporate Secretary (Domestic)</SelectItem>
                          <SelectItem value="Resident Agent (Foreign)">Resident Agent (Foreign)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Signatory Office Address</Label>
                      <Input 
                        placeholder="Enter Signatory's Office Address" 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secSignatoryAddress}
                        onChange={(e) => setSecSignatoryAddress(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Meeting Date</Label>
                      <Input 
                        type="date"
                        className="h-12 border-slate-200"
                        value={secMeetingDate}
                        onChange={(e) => setSecMeetingDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">Valid ID</Label>
                      <Input 
                        placeholder="e.g., Philippine Passport" 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secIdType}
                        onChange={(e) => setSecIdType(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#123765] font-bold uppercase text-[10px] tracking-widest">ID Number</Label>
                      <Input 
                        placeholder="e.g., P1234567A" 
                        className="h-12 border-slate-200 focus:ring-2 focus:ring-[#123765]/20 focus:border-[#123765] transition-all"
                        value={secIdNumber}
                        onChange={(e) => setSecIdNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-8">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setStep(1);
                        setDocumentType(null);
                      }} 
                      className="text-slate-600 hover:text-[#123765] h-10 px-4"
                    >
                      <ChevronLeft size={18} className="mr-2" /> Back to Document Selection
                    </Button>
                    <Button 
                      className="bg-[#123765] hover:bg-[#0d2a4d] text-white px-8 py-5 text-md shadow-md rounded-lg transition-all group"
                      onClick={() => setStep(3)}
                    >
                      Finalize Document & Review <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key={documentType === 'spa' ? "preview_spa" : "preview_sec"}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col"
            >
              {/* Toolbar */}
              <div className="bg-white border-b p-4 flex justify-between items-center sticky top-[75px] z-40 shadow-sm no-print">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2 border-slate-200 text-slate-600">
                    <ChevronLeft size={18} /> Return to Drafting
                  </Button>
                  <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
                  <div className="hidden md:flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-[#123765] tracking-widest">Document Status</span>
                    <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                      <Scale size={12} /> Verified Legal Standard
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button onClick={handleExportPDF} className="bg-[#123765] hover:bg-[#0d2a4d] text-white gap-2 shadow-md px-6">
                    <FileDown size={18} /> Export PDF
                  </Button>
                </div>
              </div>

              <DocumentPreview 
                details={details} 
                documentType={documentType as 'spa' | 'sec' | 'sec_dispute'}
                secDetails={{
                  signatoryName: secSignatoryType === 'Others (Manual Input)' ? (secManualSignatory || 'Others (Manual Input)') : secSignatoryType,
                  signatoryCapacity: secSignatoryCapacity,
                  signatoryAddress: secSignatoryAddress,
                  corpName: secCorpName,
                  corpAddress: secCorpAddress,
                  meetingType: secMeetingType,
                  meetingDate: secMeetingDate,
                  headline: secHeadline,
                  idType: secIdType,
                  idNumber: secIdNumber,
                  clauses: extractedClauses
                }}
                contentRef={contentRef} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Refine Dialog */}
      <Dialog open={isRefineDialogOpen} onOpenChange={setIsRefineDialogOpen}>
        <DialogContent className="max-w-xl no-print">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-[#ccaa49]" /> AI Legal Refiner
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {refineOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => applyRefinedText(opt.text)}
                className="w-full text-left p-4 rounded-lg border border-muted hover:border-[#ccaa49] hover:bg-[#fffdf5] transition-all group"
              >
                <div className="text-[10px] font-bold uppercase text-[#ccaa49] mb-1">{opt.label}</div>
                <div className="text-sm leading-relaxed">{opt.text}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
