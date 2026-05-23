package to.treasures.app;

import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(QRPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(name = "QRPlugin")
    public static class QRPlugin extends Plugin {

        /**
         * Save a base64-encoded PNG to the device's Pictures/Downloads.
         * Call: Capacitor.Plugins.QRPlugin.saveImage({ base64: '...', filename: 'foo.png' })
         */
        @PluginMethod
        public void saveImage(PluginCall call) {
            String base64 = call.getString("base64");
            String filename = call.getString("filename", "qr-code.png");

            if (base64 == null || base64.isEmpty()) {
                call.reject("base64 is required");
                return;
            }

            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                saveToMediaStore(getContext(), bytes, filename);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to save image: " + e.getMessage());
            }
        }

        private void saveToMediaStore(Context ctx, byte[] bytes, String filename) throws IOException {
            OutputStream out;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/Treasures");
                Uri uri = ctx.getContentResolver()
                        .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("MediaStore insert returned null");
                out = ctx.getContentResolver().openOutputStream(uri);
            } else {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                        "Treasures");
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, filename);
                out = new FileOutputStream(file);
            }
            if (out == null) throw new IOException("Could not open output stream");
            out.write(bytes);
            out.close();
        }

        /**
         * Print a base64-encoded PNG using Android's PrintManager.
         * Call: Capacitor.Plugins.QRPlugin.printImage({ base64: '...' })
         */
        @PluginMethod
        public void printImage(PluginCall call) {
            String base64 = call.getString("base64");
            if (base64 == null || base64.isEmpty()) {
                call.reject("base64 is required");
                return;
            }

            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) {
                call.reject("Could not decode image");
                return;
            }

            getActivity().runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getContext()
                        .getSystemService(Context.PRINT_SERVICE);
                pm.print("Treasures QR Code",
                        new BitmapPrintAdapter(bitmap),
                        new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.NA_LETTER)
                                .setResolution(new PrintAttributes.Resolution(
                                        "treasures-300", "Treasures 300dpi", 300, 300))
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                .build());
            });
            call.resolve();
        }

        /**
         * PrintDocumentAdapter that wraps a bitmap into a single-page PDF
         * sized to the requested print attributes. Android's print
         * framework expects PDF content on the file descriptor — writing
         * raw PNG bytes causes the print preview to fail silently.
         */
        private static class BitmapPrintAdapter extends PrintDocumentAdapter {
            private final Bitmap bitmap;
            private PrintAttributes attributes;

            BitmapPrintAdapter(Bitmap bitmap) {
                this.bitmap = bitmap;
            }

            @Override
            public void onLayout(PrintAttributes oldAttrs, PrintAttributes newAttrs,
                                  CancellationSignal cancel, LayoutResultCallback cb,
                                  Bundle extras) {
                if (cancel.isCanceled()) { cb.onLayoutCancelled(); return; }
                this.attributes = newAttrs;
                PrintDocumentInfo info = new PrintDocumentInfo.Builder("qr-code.pdf")
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_PHOTO)
                        .setPageCount(1)
                        .build();
                cb.onLayoutFinished(info, !newAttrs.equals(oldAttrs));
            }

            @Override
            public void onWrite(PageRange[] pages, ParcelFileDescriptor dest,
                                CancellationSignal cancel, WriteResultCallback cb) {
                PdfDocument document = new PdfDocument();
                try {
                    // Compute page size in points (1/72 inch). Media size
                    // dimensions are in mils (1/1000 inch).
                    PrintAttributes.MediaSize media = attributes != null
                            ? attributes.getMediaSize() : PrintAttributes.MediaSize.NA_LETTER;
                    if (media == null) media = PrintAttributes.MediaSize.NA_LETTER;
                    int widthPts = (int) Math.round(media.getWidthMils() * 72.0 / 1000.0);
                    int heightPts = (int) Math.round(media.getHeightMils() * 72.0 / 1000.0);

                    PdfDocument.PageInfo pageInfo =
                            new PdfDocument.PageInfo.Builder(widthPts, heightPts, 1).create();
                    PdfDocument.Page page = document.startPage(pageInfo);
                    Canvas canvas = page.getCanvas();

                    // Honor minimum margins from the print attributes so the
                    // image always fits inside the printable area.
                    PrintAttributes.Margins margins = attributes != null
                            ? attributes.getMinMargins() : PrintAttributes.Margins.NO_MARGINS;
                    if (margins == null) margins = PrintAttributes.Margins.NO_MARGINS;
                    float leftPts = (float) (margins.getLeftMils() * 72.0 / 1000.0);
                    float topPts = (float) (margins.getTopMils() * 72.0 / 1000.0);
                    float rightPts = (float) (margins.getRightMils() * 72.0 / 1000.0);
                    float bottomPts = (float) (margins.getBottomMils() * 72.0 / 1000.0);

                    float printableWidth = widthPts - leftPts - rightPts;
                    float printableHeight = heightPts - topPts - bottomPts;

                    // Preserve aspect ratio and center the image inside the
                    // printable area.
                    float scale = Math.min(
                            printableWidth / bitmap.getWidth(),
                            printableHeight / bitmap.getHeight());
                    float renderWidth = bitmap.getWidth() * scale;
                    float renderHeight = bitmap.getHeight() * scale;
                    float left = leftPts + (printableWidth - renderWidth) / 2f;
                    float top = topPts + (printableHeight - renderHeight) / 2f;

                    Paint paint = new Paint();
                    paint.setAntiAlias(true);
                    paint.setFilterBitmap(true);
                    paint.setDither(true);
                    RectF destRect = new RectF(left, top, left + renderWidth, top + renderHeight);
                    Rect srcRect = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
                    canvas.drawBitmap(bitmap, srcRect, destRect, paint);

                    document.finishPage(page);

                    if (cancel.isCanceled()) {
                        cb.onWriteCancelled();
                        return;
                    }

                    try (OutputStream out = new FileOutputStream(dest.getFileDescriptor())) {
                        document.writeTo(out);
                    }
                    cb.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                } catch (Exception e) {
                    cb.onWriteFailed(e.getMessage());
                } finally {
                    document.close();
                }
            }
        }
    }
}
