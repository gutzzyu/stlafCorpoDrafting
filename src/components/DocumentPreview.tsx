import React, { useState, useEffect, useRef } from 'react';
import { Scale } from 'lucide-react';
import { SPADetails, SecDetails } from '../types';
import { cn } from '@/lib/utils';

interface DocumentPreviewProps {
  details: SPADetails;
  secDetails?: SecDetails;
  documentType: 'spa' | 'sec';
  contentRef: React.RefObject<HTMLDivElement>;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ details, secDetails, documentType, contentRef }) => {
  const [estimatedPages, setEstimatedPages] = useState(1);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();

  const {
    affiantName,
    nationality,
    civilStatus,
    address,
    representatives,
    idType,
    idNumber,
    purposes,
    paperSize
  } = details;

  useEffect(() => {
    const updatePages = () => {
      if (!contentContainerRef.current) return;
      const height = contentContainerRef.current.getBoundingClientRect().height;
      let pixelsPerPage = 1056;
      if (paperSize === 'a4') pixelsPerPage = 930;
      if (paperSize === 'letter') pixelsPerPage = 864;
      
      const pages = Math.ceil(height / pixelsPerPage);
      setEstimatedPages(pages + 1);
    };

    // Run immediately
    updatePages();

    // Run after a tiny delay to ensure React has fully painted the new text to the DOM
    const timeoutId = setTimeout(updatePages, 50);

    // Keep ResizeObserver as a fallback for any layout shifts
    const observer = new ResizeObserver(() => {
      updatePages();
    });

    if (contentContainerRef.current) {
      observer.observe(contentContainerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [details, paperSize]);

  const numberToWords = (num: number) => {
    const words = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
    return words[num] || num.toString();
  };

  const paperClasses = {
    legal: 'w-[8.5in] min-h-[13in]',
    a4: 'w-[210mm] min-h-[297mm]',
    letter: 'w-[8.5in] min-h-[11in]'
  };

  return (
    <div className="flex flex-col items-center bg-muted p-8 overflow-auto print:bg-white print:p-0 print-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&display=swap');
        
        .document-font {
          font-family: 'Book Antiqua', 'Palatino Linotype', 'Palatino', 'Georgia', serif !important;
        }

        @media print {
          /* Hide UI elements marked with no-print */
          .no-print { display: none !important; }

          /* Reset layout constraints on all parent containers so the document flows naturally */
          body, #root, .min-h-screen, main, .overflow-auto {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
          }

          /* Ensure the print content takes full width and removes screen styles */
          .print-content { 
            width: 100% !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          @page { size: ${paperSize === 'legal' ? '8.5in 13in' : paperSize}; margin: 1in; }
          
          .page-break { page-break-before: always !important; }
          .no-break { page-break-inside: avoid !important; }
          
          /* Prevent table rows from splitting across pages */
          tr { page-break-inside: avoid !important; }
          table { page-break-inside: auto !important; }
        }
      `}} />

      <div
        ref={contentRef}
        className={cn(
          "bg-white shadow-2xl p-[1in] document-font text-black text-[12pt] print:shadow-none print:p-0 print:m-0 print-content",
          paperClasses[paperSize]
        )}
      >
        {/* Page 1 Content */}
        <div className="flex flex-col" ref={contentContainerRef}>
          {documentType === 'spa' ? (
            <>
              <div className="text-center font-bold mb-12 uppercase">
                SPECIAL POWER OF ATTORNEY
              </div>  

              <div className="font-bold mb-8 uppercase">KNOW ALL MEN BY THESE PRESENTS:</div>

              <div className="mb-6 leading-relaxed">
                I, <strong>{affiantName || "[NAME OF PRINCIPAL]"}</strong>, of legal age, {nationality || "Filipino"}, {civilStatus || "[CIVIL STATUS]"}, resident of {address || "[COMPLETE ADDRESS]"}, do hereby constitute and appoint representatives of <strong>SADSAD TAMESIS LEGAL AND ACCOUNTANCY FIRM</strong> including <strong>{representatives || "[NAME OF REPRESENTATIVES]"}</strong> of legal ages, Filipino, as my true and legal representatives to act for and in my name and stead and perform the following acts and things to wit:
              </div>

              <div className="print:break-inside-avoid">
                <ol className="list-decimal ml-8 mb-6 space-y-4">
                  {purposes.map((p) => {
                    let formattedText = p.text;
                    
                    // Logic to cleanly inject RDO or LGU details without repetition
                    if (p.agency === 'BIR' && p.rdo) {
                      const rdoSuffix = ` - ${p.rdo}`;
                      // Check if the RDO is already present in the text
                      if (!formattedText.includes(p.rdo)) {
                        if (formattedText.includes('Bureau of Internal Revenue (BIR)')) {
                          formattedText = formattedText.replace('Bureau of Internal Revenue (BIR)', `Bureau of Internal Revenue (BIR)${rdoSuffix}`);
                        } else if (formattedText.includes('BIR')) {
                          formattedText = formattedText.replace('BIR', `BIR${rdoSuffix}`);
                        } else {
                          formattedText += rdoSuffix;
                        }
                      }
                    } else if (p.agency === 'LGU' && p.lgu) {
                      const lguSuffix = ` - ${p.lgu}`;
                      // Check if the LGU is already present in the text
                      if (!formattedText.includes(p.lgu)) {
                        if (formattedText.includes('Local Government Unit (LGU)')) {
                          formattedText = formattedText.replace('Local Government Unit (LGU)', `Local Government Unit (LGU)${lguSuffix}`);
                        } else if (formattedText.includes('LGU')) {
                          formattedText = formattedText.replace('LGU', `LGU${lguSuffix}`);
                        } else {
                          formattedText += lguSuffix;
                        }
                      }
                    }

                    return (
                      <li key={p.id} className="pl-2 leading-relaxed text-justify">
                        {formattedText}
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="mb-8 leading-relaxed">
                <strong>HEREBY GRANTING</strong> unto my representative full power and authority to execute and perform every act necessary to render effective the abovementioned power, as though I myself, has so performed it, and <strong>HEREBY APPROVING ALL</strong> that he/she may do by virtue hereof this authority. I have no objection for the said named authorized representatives, signing the documents on my behalf in my absence.
              </div>

              <div className="no-break">
                <div className="mb-12 leading-relaxed">
                  <strong>IN WITNESS WHEREOF</strong>, I have hereunto set my hand this ____ day of ____________ {currentYear}.
                </div>

                <div className="flex flex-col items-end mb-12 mt-20">
                  <div className="flex flex-col items-center min-w-[250px]">
                    <div className="w-full border-b border-black mb-1"></div>
                    <div className="font-bold uppercase text-center leading-tight">
                      {affiantName || "AFFIANT"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col mb-12 ml-0 mr-auto w-fit">
                <div className="grid grid-cols-[auto_20px_auto] items-center">
                  <div className="font-bold uppercase whitespace-nowrap">REPUBLIC OF THE PHILIPPINES</div>
                  <div className="font-bold uppercase text-center">)</div>
                  <div className="w-10"></div>
                </div>
                <div className="grid grid-cols-[auto_20px_auto] items-center">
                  <div className="border-b border-black min-w-[250px]">&nbsp;</div>
                  <div className="font-bold uppercase text-center">)</div>
                  <div className="font-bold uppercase whitespace-nowrap ml-1">S.S.</div>
                </div>
              </div>

              <div className="text-center font-bold mb-12 uppercase">
                SECRETARY'S CERTIFICATE
              </div>

              <div className="mb-6 leading-relaxed indent-12">
                I, <strong>{secDetails?.signatoryName || "[NAME OF SECRETARY]"}</strong>, of legal age, Filipino, with office address at <strong>{secDetails?.signatoryAddress || "[SIGNATORY OFFICE ADDRESS]"}</strong>, after being duly sworn in accordance with law, hereby certify that:
              </div>

              <div className="space-y-6 mb-8 text-justify">
                <div className="flex gap-4">
                  <span className="font-bold">1.</span>
                  <span>I am the duly elected and qualified <strong>{secDetails?.signatoryCapacity.split(' (')[0] || "Corporate Secretary"}</strong> of <strong>{secDetails?.corpName || "[CORPORATE NAME]"}</strong> (the "Corporation"), a corporation duly organized and existing under and by virtue of the laws of the Republic of the Philippines with address at <strong>{secDetails?.corpAddress || "[PRINCIPAL OFFICE ADDRESS]"}</strong>.</span>
                </div>

                <div className="flex gap-4">
                  <span className="font-bold">2.</span>
                  <span>That as <strong>{secDetails?.signatoryCapacity.split(' (')[0] || "Corporate Secretary"}</strong>, I am the custodian of the corporate records of the Corporation including minutes of the meetings of its stockholders and Board of Directors.</span>
                </div>

                <div className="flex gap-4">
                  <span className="font-bold">3.</span>
                  <span>That during the <strong>{secDetails?.meetingType || "[MEETING TYPE]"} Meeting</strong> of the Board of Directors of the Corporation held on <strong>{secDetails?.meetingDate ? new Date(secDetails.meetingDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : "[MEETING DATE]"}</strong>, at which meeting a quorum was present and acted throughout, the following resolutions was unanimously adopted and approved:</span>
                </div>
              </div>

              <div className="ml-8 space-y-4 mb-12 text-justify pl-12 pr-12">
                {secDetails?.clauses.map((clause, idx) => (
                  <div key={clause.id} className="leading-relaxed">
                    <div className={clause.tableData ? "mb-4" : ""}>
                      <strong>{idx === 0 ? '"' : ''}{clause.type}</strong>{clause.text.trim().startsWith(',') ? '' : ','} {clause.text.trim()}{!clause.tableData && idx === (secDetails?.clauses.length || 0) - 1 ? '"' : ''}
                    </div>
                    {clause.tableData && clause.tableData.length > 0 && Array.isArray(clause.tableData[0]) && String(clause.tableData[0][0] || "").toLowerCase() !== "null" && (
                      <div className="mb-4 w-full">
                        <table className="w-[99%] mx-auto border-collapse border border-black text-[12pt]">
                          <tbody>
                            {clause.tableData.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="border border-black p-2 text-center">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {idx === (secDetails?.clauses.length || 0) - 1 && <span className="block mt-2 font-bold">"</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-6 mb-12">
                <div className="flex gap-4">
                  <span className="font-bold">4.</span>
                  <span>The above resolution has not been amended or revoked and can be relied upon until a subsequent resolution of the Board of Directors amending, modifying, or revoking the said resolution has been served upon the parties concerned.</span>
                </div>
              </div>

              <div className="mb-12 leading-relaxed indent-12">
                <strong>IN WITNESS WHEREOF</strong>, I affix my signature this ____ day of ____________ {currentYear} in ____________________.
              </div>

              <div className="flex flex-col items-center mb-4 mt-8 ml-auto mr-0 w-fit">
                <div className="flex flex-col items-center min-w-[300px]">
                  <div className="w-full border-b border-black mb-1"></div>
                  <div className="font-bold uppercase text-center leading-tight">
                    {secDetails?.signatoryName || "SIGNATORY NAME"}
                  </div>
                  <div className="text-sm mt-1">{secDetails?.signatoryCapacity.split(' (')[0] || "Corporate Secretary"}</div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Page 2: Jurat / Acknowledgement Section */}
        <div className="no-break mt-4 page-break pt-[0.2in] flex flex-col">
          {documentType === 'spa' ? (
            <>
              <div className="text-center font-bold mb-12 uppercase">
                ACKNOWLEDGEMENT
              </div>

              <div className="flex flex-col mb-8 ml-0 mr-auto w-fit">
                <div className="grid grid-cols-[auto_20px_auto] items-center">
                  <div className="font-bold uppercase whitespace-nowrap">REPUBLIC OF THE PHILIPPINES</div>
                  <div className="font-bold uppercase text-center">)</div>
                  <div className="w-10"></div>
                </div>
                <div className="grid grid-cols-[auto_20px_auto] items-center">
                  <div className="border-b border-black min-w-[250px]">&nbsp;</div>
                  <div className="font-bold uppercase text-center">)</div>
                  <div className="font-bold uppercase whitespace-nowrap ml-1">S.S.</div>
                </div>
              </div>

              <div className="mb-6 leading-relaxed">
                I certify that on ____________ before me, a notary public duly authorized in the city named above to make acknowledgments personally appeared:
              </div>

              <table className="w-[99%] mx-auto table-fixed border-collapse border border-black mb-8">
                <thead>
                  <tr>
                    <th className="border border-black p-3 text-center font-bold text-sm uppercase w-1/2">NAME</th>
                    <th className="border border-black p-3 text-center font-bold text-sm uppercase w-1/2">COMPETENT EVIDENCE OF IDENTITY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-3 font-bold text-center align-middle h-24 uppercase">
                      {affiantName || "[NAME OF PRINCIPAL]"}
                    </td>
                    <td className="border border-black p-3 text-center align-middle h-24">
                      {idType || "[ID TYPE]"} No. {idNumber || "[ID NUMBER]"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mb-6 leading-relaxed">
                Who is identified by me through his/her aforementioned competent evidence of identity to be the same person in the foregoing Special Power of Attorney consisting of <strong>{numberToWords(estimatedPages)} ({estimatedPages})</strong> pages, including in which this Acknowledgment is written, and who acknowledged to me that the signature appearing above was voluntarily affixed by him/her for the purposes stated therein, and who declared to me that he/she has executed the Special Power of Attorney as his/her free and voluntary act and deed.
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 leading-relaxed text-justify indent-12">
                <strong>SUBSCRIBED AND SWORN</strong> to before me, a notary public in and for ____________________ this ____ day of ____________ {currentYear}, affiant personally appeared. I identified him/her, through competent evidence of identity, particularly, <strong>{secDetails?.idType || "[ID TYPE]"} No. {secDetails?.idNumber || "[ID NUMBER]"}</strong> to be the same person who presented the foregoing instrument, signed in my presence, and who took an oath before me as to such instrument.
              </div>
            </>
          )}

          <div className="flex justify-between items-start mt-8">
            <div className="space-y-1 text-[12pt] flex flex-col">
              <div className="grid grid-cols-[100px_120px_10px] items-end">
                <span>Doc. No.</span>
                <span className="border-b border-black mx-1 mb-[2px]"></span>
                <span>;</span>
              </div>
              <div className="grid grid-cols-[100px_120px_10px] items-end">
                <span>Page No.</span>
                <span className="border-b border-black mx-1 mb-[2px]"></span>
                <span>;</span>
              </div>
              <div className="grid grid-cols-[100px_120px_10px] items-end">
                <span>Book No.</span>
                <span className="border-b border-black mx-1 mb-[2px]"></span>
                <span>;</span>
              </div>
              <div className="grid grid-cols-[100px_120px_10px] items-end">
                <span>Series of</span>
                <span className="mx-1">{currentYear}.</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center min-w-[250px] mt-1">
              <div className="text-center font-bold uppercase">
                NOTARY PUBLIC
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
