import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ContratoVisualizacao from "./ContratoVisualizacao";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ContratoData, ResidenteData, EmpresaData } from "./types";

interface ContratoPDFGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: ContratoData;
  residente: ResidenteData;
  empresa?: EmpresaData;
}

export default function ContratoPDFGenerator({
  open,
  onOpenChange,
  contrato,
  residente,
  empresa
}: ContratoPDFGeneratorProps) {
  const contratoRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!contratoRef.current) return;

    try {
      toast({
        title: "Gerando PDF...",
        description: "Aguarde enquanto o documento é gerado.",
      });

      const element = contratoRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      
      const pageHeight = pdfHeight / ratio;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', imgX, position * ratio, imgWidth * ratio, imgHeight * ratio);
        heightLeft -= pageHeight;
      }

      pdf.save(`Contrato_${contrato.numero_contrato.replace('/', '-')}_${residente.nome_completo.split(' ')[0]}.pdf`);

      toast({
        title: "PDF gerado com sucesso!",
        description: "O download foi iniciado.",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o documento. Tente usar a impressão.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Contrato nº {contrato.numero_contrato}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button size="sm" onClick={handleDownloadPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto border rounded-lg bg-gray-100 p-4">
          <ContratoVisualizacao
            ref={contratoRef}
            contrato={contrato}
            residente={residente}
            empresa={empresa}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
